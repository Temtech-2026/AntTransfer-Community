/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.anttransfer.it;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.storage.FileStorage;
import com.anttransfer.transfer.model.dto.MergeRequest;
import com.anttransfer.transfer.model.dto.PrecheckRequest;
import com.anttransfer.transfer.model.entity.TransferTask;
import com.anttransfer.transfer.model.vo.ChunkPartsVO;
import com.anttransfer.transfer.model.vo.MergeResultVO;
import com.anttransfer.transfer.model.vo.PrecheckResultVO;
import com.anttransfer.transfer.service.ChunkStore;
import com.anttransfer.transfer.service.TransferTaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 分片上传「断点续传 → 合并」端到端集成测试。
 *
 * <p><b>为什么必须是集成测试</b>：本链路的正确性由三处协作共同决定——任务状态机的 CAS
 * 迁移（MySQL）、暂存分片的物理存在性（磁盘）、内容寻址落库（at-file）。单测把
 * mapper / 文件系统都 mock 掉之后，「已传索引说收到了、但磁盘上分片丢了」这类
 * 跨边界缺陷根本照不出来。这里用 Testcontainers 起真 MySQL 8.4 + Redis 7，
 * 让 Flyway 建真表，并把暂存根与存储根指向临时目录，用真字节跑完整条链路。</p>
 *
 * <p>核心断言：<b>合并落库后，内容寻址文件上的字节 sha256 与源文件逐位一致</b>，
 * 且任务落为「已完成」、file_id 回填。</p>
 *
 * <p>依赖说明：需要 Docker（Testcontainers）；本机无 Docker 时自动跳过
 * （{@code disabledWithoutDocker}）。</p>
 *
 * @author AntTransfer CE
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ChunkedUploadMergeIntegrationTest {

    /** 测试分片大小：压到 256 KiB，3 片即可覆盖「中间片 + 末片余数」两种长度。 */
    private static final int CHUNK_SIZE = 256 * 1024;
    /** 源文件大小：2 个整片 + 1 个余数片（262144 / 262144 / 175712）。 */
    private static final int FILE_SIZE = 700_000;
    private static final int EXPECTED_CHUNK_COUNT = 3;

    private static final Path STAGING_ROOT = createTempDir("anttransfer-it-staging");
    private static final Path STORAGE_ROOT = createTempDir("anttransfer-it-storage");

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("anttransfer")
            .withUsername("root")
            .withPassword("123456")
            .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci");

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
                    .withExposedPorts(6379);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () ->
                "jdbc:mysql://" + MYSQL.getHost() + ":" + MYSQL.getMappedPort(3306)
                        + "/anttransfer?useUnicode=true&characterEncoding=utf-8"
                        + "&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai");
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));

        // 分片大小/暂存根/存储根全部走临时目录，避免污染工作区、也避免用例之间互相污染
        registry.add("anttransfer.transfer.chunk-size", () -> CHUNK_SIZE);
        registry.add("anttransfer.transfer.staging-root", STAGING_ROOT::toString);
        registry.add("anttransfer.file.storage-root", STORAGE_ROOT::toString);
        // 单文件 10 GiB 上限对齐，但分片上限压小以守住 uploaded_indexes 长度语义
        registry.add("anttransfer.transfer.max-chunk-count", () -> 1024);
        // 并发任务上限设为 2，便于用「第三个任务」精确触发 4103
        registry.add("anttransfer.transfer.max-active-tasks", () -> 2);
        // 上传类型闸门（扩展名白名单 + 魔数一致性）由 FileUploadValidator 单测与
        // UploadWhitelistConfigTest 专项覆盖；本用例要验的是「分片 → 合并 → 字节逐位一致」，
        // 载荷是与任何文件格式无关的随机字节，故在此只放开 bin。
        // 两点必须留意：
        //   ① 覆盖的仅是测试上下文，绝不放宽生产 application.yml 的白名单——放行范围是业务策略，
        //      不能为了测试变宽松（生产配置由 UploadWhitelistConfigTest 守住）；
        //   ② 随机载荷仍会过「可执行魔数」分支：首 2 字节为 MZ（或首 4 字节为 ELF）时，
        //      FileMagic 判为 executable 族，本类会以「文件内容与扩展名不符（疑似伪装文件）」拒绝。
        //      当前种子实测未命中；将来换种子或改 FILE_SIZE 需重跑本类确认。
        registry.add("anttransfer.file.allowed-extensions", () -> "bin");
    }

    @Autowired
    private TransferTaskService transferTaskService;
    @Autowired
    private ChunkStore chunkStore;
    @Autowired
    private FileStorage fileStorage;
    @Autowired
    private JdbcTemplate jdbc;

    private long adminId;

    @BeforeEach
    void resolveAdmin() {
        Long id = jdbc.queryForObject("select id from sys_user where username = 'admin'", Long.class);
        assertTrue(id != null && id > 0, "V2 初始数据应存在 admin 用户");
        adminId = id;
        // 用例之间共享同一个 Spring 上下文与同一个真库，而 max-active-tasks=2 是全局闸门：
        // 上一个用例遗留的「传输中」任务会吃掉名额，让后续用例在预检处就被 4103 拦掉。
        // 每个用例从空任务表出发，配额的语义才只由当前用例自己决定。
        jdbc.update("delete from sys_upload_task where user_id = ?", adminId);
    }

    /* ======================= 1) 主干：断点续传后合并，sha256 一致 ======================= */

    @Test
    @DisplayName("断点续传：跳过中间片 → 合并报 4002 缺片 → 补齐后合并，落库内容 sha256 与源文件一致")
    void resumeThenMerge_shouldPreserveSourceSha256() throws Exception {
        byte[] source = payload("resume-happy-path");
        String sourceSha = sha256(source);

        // ① 预检未命中：拿到上传票据（真 MySQL 建任务）
        PrecheckResultVO precheck = transferTaskService.precheck(adminId,
                new PrecheckRequest("resume.bin", (long) source.length, sourceSha, 0L));
        assertThat(precheck.instant()).isFalse();
        assertThat(precheck.chunkSize()).isEqualTo(CHUNK_SIZE);
        assertThat(precheck.chunkCount()).isEqualTo(EXPECTED_CHUNK_COUNT);
        long uploadId = Long.parseLong(precheck.uploadId());

        // ② 只传第 0、2 片，故意跳过第 1 片（模拟断线）
        uploadPart(uploadId, 0, source, sourceSha);
        uploadPart(uploadId, 2, source, sourceSha);

        // ③ 服务端已确认清单是权威续传判据：只应有 0、2，升序
        ChunkPartsVO parts = transferTaskService.parts(adminId, uploadId);
        assertThat(parts.received()).containsExactly(0, 2);

        // ④ 此时合并必须报 4002（流程分支，不抛异常），且带回缺失清单
        MergeResultVO missing = transferTaskService.merge(adminId, uploadId,
                new MergeRequest(sourceSha, EXPECTED_CHUNK_COUNT, (long) source.length));
        assertThat(missing.isChunkMissing()).isTrue();
        assertThat(missing.missing()).containsExactly(1);
        assertThat(missing.received()).containsExactly(0, 2);
        // 缺片不是失败：任务必须仍可续传（未落终态、暂存未被清）
        assertThat(taskStatus(uploadId)).isEqualTo(TransferTask.STATUS_UPLOADING);

        // ⑤ 断点续传跨会话：同指纹再预检必须复用同一 uploadId，而不是另起一份暂存
        PrecheckResultVO again = transferTaskService.precheck(adminId,
                new PrecheckRequest("resume.bin", (long) source.length, sourceSha, 0L));
        assertThat(again.instant()).isFalse();
        assertThat(again.uploadId()).isEqualTo(precheck.uploadId());

        // ⑥ 补齐缺失分片后合并成功
        uploadPart(uploadId, 1, source, sourceSha);
        MergeResultVO merged = transferTaskService.merge(adminId, uploadId,
                new MergeRequest(sourceSha, EXPECTED_CHUNK_COUNT, (long) source.length));
        assertThat(merged.isChunkMissing()).isFalse();
        assertThat(merged.sha256()).isEqualTo(sourceSha);

        // ⑦ 任务落为「已完成」且 file_id 回填
        Map<String, Object> task = jdbc.queryForMap(
                "select status, file_id from sys_upload_task where id = ?", uploadId);
        assertThat(((Number) task.get("status")).intValue()).isEqualTo(TransferTask.STATUS_COMPLETED);
        assertThat(task.get("file_id")).isNotNull();

        // ⑧ 最关键的一条：内容寻址文件上的字节 sha256 与源文件一致（真字节，不是「元数据说一致」）
        assertThat(fileStorage.contentExists(sourceSha)).isTrue();
        assertThat(fileStorage.contentSize(sourceSha)).isEqualTo(source.length);
        assertThat(sha256(readAll(fileStorage.contentResource(sourceSha).getInputStream())))
                .isEqualTo(sourceSha);

        // ⑨ sys_file 元数据与源文件对齐，且引用计数为 1
        Map<String, Object> file = jdbc.queryForMap(
                "select size_bytes, ref_count, upload_user_id from sys_file where sha256 = ?", sourceSha);
        assertThat(((Number) file.get("size_bytes")).longValue()).isEqualTo(source.length);
        assertThat(((Number) file.get("ref_count")).intValue()).isEqualTo(1);

        // ⑩ 终态之后再次合并视为「任务不存在」（让前端重走预检 → 秒传命中），而非脏写
        assertThatThrownBy(() -> transferTaskService.merge(adminId, uploadId,
                new MergeRequest(sourceSha, EXPECTED_CHUNK_COUNT, (long) source.length)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(errorCodeOf(e)).isEqualTo(ErrorCode.TRANSFER_TASK_NOT_FOUND));
    }

    /* ======================= 2) 分片哈希不符：拒绝并丢弃残片 ======================= */

    @Test
    @DisplayName("分片哈希不符：以 4003 拒绝、不记账，且残片被删除（避免污染下一次合并）")
    void savePart_withMismatchedChunkHash_shouldRejectAndDropChunk() {
        byte[] source = payload("chunk-hash-mismatch");
        String sourceSha = sha256(source);
        long uploadId = newUpload(source, sourceSha, "mismatch.bin");

        String wrongHash = "0".repeat(64);

        assertThatThrownBy(() -> transferTaskService.savePart(adminId, uploadId, 0, wrongHash,
                new ByteArrayInputStream(source, 0, CHUNK_SIZE), CHUNK_SIZE))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(errorCodeOf(e)).isEqualTo(ErrorCode.FILE_INTEGRITY_ERROR));

        // 记账未发生：清单为空
        assertThat(transferTaskService.parts(adminId, uploadId).received()).isEmpty();
        // 残片已从暂存目录删除：否则下一次合并会把这份坏字节拼进去
        assertThat(chunkStore.hasChunk(uploadId, 0)).isFalse();

        // 同一片用正确哈希重传必须成功——证明上一次的残片确实被清掉了
        uploadPart(uploadId, 0, source, sourceSha);
        assertThat(transferTaskService.parts(adminId, uploadId).received()).containsExactly(0);
    }

    /* ======================= 3) 磁盘分片丢失：合并必须识别为缺片 ======================= */

    @Test
    @DisplayName("磁盘分片丢失：已传索引说齐了，但落盘分片被删 → 合并仍报缺片 4002")
    void merge_whenChunkFileVanishedOnDisk_shouldReportMissing() {
        byte[] source = payload("chunk-vanished-on-disk");
        String sourceSha = sha256(source);
        long uploadId = newUpload(source, sourceSha, "vanished.bin");

        uploadPart(uploadId, 0, source, sourceSha);
        uploadPart(uploadId, 1, source, sourceSha);
        uploadPart(uploadId, 2, source, sourceSha);
        assertThat(transferTaskService.parts(adminId, uploadId).received()).containsExactly(0, 1, 2);

        // 模拟运维误删 / 磁盘故障：索引仍声称收到，但物理分片没了
        chunkStore.deleteChunk(uploadId, 1);
        assertThat(chunkStore.hasChunk(uploadId, 1)).as("第 1 片应已从暂存盘消失").isFalse();

        MergeResultVO result = transferTaskService.merge(adminId, uploadId,
                new MergeRequest(sourceSha, EXPECTED_CHUNK_COUNT, (long) source.length));
        assertThat(result.isChunkMissing()).isTrue();
        assertThat(result.missing()).containsExactly(1);
        // 结论：判定依据必须是「索引 ∩ 磁盘」，只信索引会让合并产出静默损坏的文件
        assertThat(taskStatus(uploadId)).isEqualTo(TransferTask.STATUS_UPLOADING);
    }

    /* ======================= 4) 并发任务上限：4103 ======================= */

    @Test
    @DisplayName("并发任务上限：达到 max-active-tasks 后再预检以 4103 拒绝，避免无界占用暂存盘")
    void precheck_whenActiveTaskQuotaExceeded_shouldReject() {
        newUpload(payload("quota-task-1"), null, "quota-1.bin");
        newUpload(payload("quota-task-2"), null, "quota-2.bin");

        byte[] third = payload("quota-task-3");
        assertThatThrownBy(() -> transferTaskService.precheck(adminId,
                new PrecheckRequest("quota-3.bin", (long) third.length, sha256(third), 0L)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(errorCodeOf(e)).isEqualTo(ErrorCode.TRANSFER_LIMIT_EXCEEDED));
    }

    /* ======================= 5) 归属校验：他人 uploadId 视为不存在 ======================= */

    @Test
    @DisplayName("越权续传：非属主读写他人 uploadId 一律 4101（不泄漏任务是否存在）")
    void partsAndSavePart_withForeignUploadId_shouldBeTreatedAsMissing() {
        byte[] source = payload("foreign-upload-id");
        String sourceSha = sha256(source);
        long uploadId = newUpload(source, sourceSha, "foreign.bin");
        long attackerId = adminId + 100_000L;

        assertThatThrownBy(() -> transferTaskService.parts(attackerId, uploadId))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(errorCodeOf(e)).isEqualTo(ErrorCode.TRANSFER_TASK_NOT_FOUND));

        assertThatThrownBy(() -> transferTaskService.savePart(attackerId, uploadId, 0, null,
                new ByteArrayInputStream(source, 0, CHUNK_SIZE), CHUNK_SIZE))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(errorCodeOf(e)).isEqualTo(ErrorCode.TRANSFER_TASK_NOT_FOUND));

        // 属主不受影响
        assertThat(transferTaskService.parts(adminId, uploadId).received()).isEmpty();
    }

    /* ============================ 辅助方法 ============================ */

    /** 预检建任务（哈希缺省时按内容实算）。 */
    private long newUpload(byte[] source, String knownSha, String fileName) {
        String sha = knownSha != null ? knownSha : sha256(source);
        PrecheckResultVO vo = transferTaskService.precheck(adminId,
                new PrecheckRequest(fileName, (long) source.length, sha, 0L));
        assertThat(vo.instant()).as("测试用内容必须唯一，不得命中秒传").isFalse();
        return Long.parseLong(vo.uploadId());
    }

    /** 上传第 index 片（按任务固化的分片大小切分源字节）。 */
    private void uploadPart(long uploadId, int index, byte[] source, String sourceSha) {
        int from = index * CHUNK_SIZE;
        int length = Math.min(CHUNK_SIZE, source.length - from);
        String chunkHash = sha256(source, from, length);
        transferTaskService.savePart(adminId, uploadId, index, chunkHash,
                new ByteArrayInputStream(source, from, length), length);
    }

    private int taskStatus(long uploadId) {
        Integer status = jdbc.queryForObject(
                "select status from sys_upload_task where id = ?", Integer.class, uploadId);
        return status == null ? -1 : status;
    }

    private static ErrorCode errorCodeOf(Throwable e) {
        return ((BusinessException) e).getErrorCode();
    }

    /** 生成确定性但每个用例互不相同的字节，避免跨用例命中秒传。 */
    private static byte[] payload(String seed) {
        byte[] data = new byte[FILE_SIZE];
        new Random(seed.hashCode() * 31L + FILE_SIZE).nextBytes(data);
        return data;
    }

    private static String sha256(byte[] data) {
        return sha256(data, 0, data.length);
    }

    private static String sha256(byte[] data, int offset, int length) {
        MessageDigest digest = newDigest();
        digest.update(data, offset, length);
        return toHex(digest.digest());
    }

    private static String sha256(InputStream in) throws IOException {
        MessageDigest digest = newDigest();
        byte[] buf = new byte[8192];
        try (DigestInputStream dis = new DigestInputStream(in, digest)) {
            while (dis.read(buf) >= 0) {
                // 读取即摘要
            }
        }
        return toHex(digest.digest());
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("JVM 必须支持 SHA-256", e);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    private static byte[] readAll(InputStream in) throws IOException {
        try (InputStream is = in) {
            return is.readAllBytes();
        }
    }

    private static Path createTempDir(String prefix) {
        try {
            return Files.createTempDirectory(prefix).toAbsolutePath().normalize();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
