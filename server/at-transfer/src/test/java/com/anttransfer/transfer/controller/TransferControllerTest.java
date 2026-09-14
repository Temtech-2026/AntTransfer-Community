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
package com.anttransfer.transfer.controller;

import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.transfer.model.dto.MergeRequest;
import com.anttransfer.transfer.model.dto.PrecheckRequest;
import com.anttransfer.transfer.model.vo.ChunkPartsVO;
import com.anttransfer.transfer.model.vo.MergeResultVO;
import com.anttransfer.transfer.model.vo.PartUploadedVO;
import com.anttransfer.transfer.model.vo.PrecheckResultVO;
import com.anttransfer.transfer.service.TransferTaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 分片上传的 HTTP 契约测试（standalone MockMvc，不起 Spring 容器）。
 *
 * <p>这里要焊死的是<b>前端已经依赖、且最容易在重构中走样</b>的三件事：</p>
 * <ol>
 *   <li>两个 B 类分支码 4001 / 4002 走的是 <b>HTTP 200 + {@code code} 区分岔路</b>，
 *       且 {@code data} 必须带着前端继续跑下去所需的载荷（票据 / 缺失分片清单）——
 *       一旦被改成抛异常，全局处理器会回 {@code Result<Void>}，data 静默丢失，
 *       前端只剩「上传失败」，秒传与补传两条路同时断掉；</li>
 *   <li>分片字节流的表单字段名是 {@code chunk}、指纹字段名是 {@code hash}，
 *       与前端 {@code PART_FILE_FIELD} / {@code PART_HASH_FIELD} 对齐（字段名不一致只会在
 *       真机联调时暴露，且表现为「空文件」这种误导性症状）；</li>
 *   <li>分片索引以 <b>路径</b> 为准（路径即资源定位），表单里的重复字段忽略。</li>
 * </ol>
 *
 * <p>注意 URL 不含 {@code /api} 前缀：该前缀由 {@code server.servlet.context-path} 提供，
 * standaloneSetup 不套用容器配置，故此处直接断言控制器自身的映射。</p>
 *
 * @author AntTransfer CE
 */
class TransferControllerTest {

    private static final long USER_ID = 7L;
    private static final String SHA = "a".repeat(64);

    private TransferTaskService transferTaskService;
    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        transferTaskService = mock(TransferTaskService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new TransferController(transferTaskService)).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(currentUser(), null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("预检命中秒传：HTTP 200 且 code=成功，data 回字符串 ID")
    void shouldReturnInstantResultWithSuccessCode() throws Exception {
        given(transferTaskService.precheck(eq(USER_ID), any(PrecheckRequest.class)))
                .willReturn(PrecheckResultVO.instant(100L, 200L));

        mockMvc.perform(precheck())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.SUCCESS.getCode()))
                .andExpect(jsonPath("$.data.instant").value(true))
                .andExpect(jsonPath("$.data.fileId").value("100"))
                .andExpect(jsonPath("$.data.nodeId").value("200"));
    }

    @Test
    @DisplayName("预检未命中：HTTP 仍是 200，靠 code=4001 表达岔路，且 data 必须带上传票据")
    void shouldReturnInstantUploadMissBranchWithTicket() throws Exception {
        given(transferTaskService.precheck(eq(USER_ID), any(PrecheckRequest.class)))
                .willReturn(PrecheckResultVO.missing(1001L, 8 * 1024 * 1024, 3));

        mockMvc.perform(precheck())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.INSTANT_UPLOAD_MISS.getCode()))
                .andExpect(jsonPath("$.data.instant").value(false))
                .andExpect(jsonPath("$.data.uploadId").value("1001"))
                .andExpect(jsonPath("$.data.chunkCount").value(3));
    }

    @Test
    @DisplayName("续传查询：回已确认分片索引与任务固化的分片参数")
    void shouldReturnReceivedParts() throws Exception {
        given(transferTaskService.parts(USER_ID, 1007L))
                .willReturn(new ChunkPartsVO(List.of(0, 2), 8, 3));

        mockMvc.perform(get("/v1/transfers/1007/parts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.SUCCESS.getCode()))
                .andExpect(jsonPath("$.data.received[0]").value(0))
                .andExpect(jsonPath("$.data.received[1]").value(2))
                .andExpect(jsonPath("$.data.chunkSize").value(8))
                .andExpect(jsonPath("$.data.chunkCount").value(3));
    }

    @Test
    @DisplayName("上传分片：表单字段名 chunk/hash、索引取路径，成功回已收索引数组")
    void shouldUploadPartWithAgreedFieldNames() throws Exception {
        given(transferTaskService.savePart(eq(USER_ID), eq(1005L), eq(2), isNull(), any(), eq(8L)))
                .willReturn(new PartUploadedVO(List.of(0, 2)));
        MockMultipartFile chunk = new MockMultipartFile(
                "chunk", "part.bin", MediaType.APPLICATION_OCTET_STREAM_VALUE, new byte[8]);

        mockMvc.perform(multipart(HttpMethod.PUT, "/v1/transfers/1005/parts/2").file(chunk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.SUCCESS.getCode()))
                // 数组而非计数：前端 PartUploadedResult.received 声明为 number[]
                .andExpect(jsonPath("$.data.received[0]").value(0))
                .andExpect(jsonPath("$.data.received[1]").value(2));

        // 索引来自路径 /parts/2，而不是表单里的冗余字段
        verify(transferTaskService).savePart(eq(USER_ID), eq(1005L), eq(2), isNull(), any(), eq(8L));
    }

    @Test
    @DisplayName("合并不全：HTTP 仍是 200，靠 code=4002 表达岔路，且 data 必须带缺失清单")
    void shouldReturnChunkMissingBranchWithMissingList() throws Exception {
        given(transferTaskService.merge(eq(USER_ID), eq(1003L), any(MergeRequest.class)))
                .willReturn(MergeResultVO.chunkMissing(List.of(0, 2), List.of(1)));

        mockMvc.perform(merge(1003L, 3, 24L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.CHUNK_MISSING.getCode()))
                .andExpect(jsonPath("$.data.received[0]").value(0))
                .andExpect(jsonPath("$.data.missing[0]").value(1));
    }

    @Test
    @DisplayName("合并成功：回文件 ID 与整件指纹")
    void shouldReturnMergedFileId() throws Exception {
        given(transferTaskService.merge(eq(USER_ID), eq(1004L), any(MergeRequest.class)))
                .willReturn(MergeResultVO.merged(999L, SHA));

        mockMvc.perform(merge(1004L, 1, 8L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.SUCCESS.getCode()))
                .andExpect(jsonPath("$.data.fileId").value("999"))
                .andExpect(jsonPath("$.data.sha256").value(SHA));
    }

    @Test
    @DisplayName("取消任务：清暂存后回成功空体")
    void shouldCancelTask() throws Exception {
        mockMvc.perform(delete("/v1/transfers/1014"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.SUCCESS.getCode()))
                .andExpect(jsonPath("$.data").doesNotExist());

        verify(transferTaskService).cancel(USER_ID, 1014L);
    }

    private org.springframework.test.web.servlet.RequestBuilder precheck() throws Exception {
        return post("/v1/transfers/precheck")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new PrecheckRequest("报告.pdf", 24L, SHA, 55L)));
    }

    private org.springframework.test.web.servlet.RequestBuilder merge(long uploadId, int chunkCount, long sizeBytes)
            throws Exception {
        return post("/v1/transfers/" + uploadId + "/merge")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new MergeRequest(SHA, chunkCount, sizeBytes)));
    }

    private static AuthenticatedUser currentUser() {
        return new AuthenticatedUser() {
            @Override
            public Long getId() {
                return USER_ID;
            }

            @Override
            public String getUsername() {
                return "tester";
            }

            @Override
            public String getNickname() {
                return "测试账号";
            }
        };
    }
}
