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
package com.anttransfer.file.extension;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.spi.crypto.CryptoCodec;
import com.anttransfer.common.spi.scan.ContentAccess;
import com.anttransfer.common.spi.scan.VirusScanner;
import com.anttransfer.common.spi.watermark.WatermarkProvider;
import com.anttransfer.file.config.FileSpiConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * at-file 三个差异化接缝（病毒扫描 / 水印 / 存储编解码）的 CE 默认行为与装配门禁。
 *
 * <p>锁两条口径：</p>
 * <ol>
 *     <li><b>CE 直通 = 零字节差异</b>：默认实现必须返回入参对象本身，不得包流——否则落盘字节、
 *         {@code Content-Length} / {@code Range} 语义会与接入本扩展点之前不一致；</li>
 *     <li><b>能力差异只由 Bean 是否存在表达</b>：EE 声明实现即自动顶替 CE 默认，业务代码零改动，
 *         也不存在 {@code if (eeEnabled)} 分支。</li>
 * </ol>
 */
class FileSpiDefaultsTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(FileSpiConfig.class);

    /* ==================== CE 直通实现 ==================== */

    @Test
    void plainCryptoCodec_shouldReturnSameStreamsWithoutWrapping() {
        PlainCryptoCodec codec = new PlainCryptoCodec();
        CryptoCodec.CryptoContext context = new CryptoCodec.CryptoContext("sha256-abc", 3L);
        OutputStream sink = new ByteArrayOutputStream();
        InputStream source = new ByteArrayInputStream(new byte[]{1, 2, 3});

        assertThat(codec.codecId()).isEqualTo("plain");
        // 同一对象 = 零包装：落盘字节与写入调用方给出的字节逐字节一致
        assertThat(codec.encrypt(sink, context)).isSameAs(sink);
        assertThat(codec.decrypt(source, context)).isSameAs(source);
    }

    @Test
    void noopWatermarkProvider_shouldReturnSameStream() {
        NoopWatermarkProvider provider = new NoopWatermarkProvider();
        InputStream source = new ByteArrayInputStream(new byte[]{9});

        assertThat(provider.providerId()).isEqualTo("noop");
        // 包装流会改变字节数，而 Content-Length 在取流之前就已写出
        assertThat(provider.wrap(source, watermarkContext())).isSameAs(source);
    }

    @Test
    void noopVirusScanner_shouldBeCleanAndNeverTouchContent() {
        NoopVirusScanner scanner = new NoopVirusScanner();
        // 一旦被调用就失败：证明 CE 默认实现连流都不打开（不做无意义的磁盘 IO）
        ContentAccess neverCalled = () -> {
            throw new AssertionError("CE 默认扫描器不得读取文件内容");
        };

        VirusScanner.VirusScanResult result = scanner.scan(new VirusScanner.VirusScanContext(
                "sha256-abc", "a.txt", "txt", 1L, 7L, neverCalled));

        assertThat(scanner.scannerId()).isEqualTo("noop");
        assertThat(result.infected()).isFalse();
        assertThat(result.threat()).isNull();
    }

    /* ==================== 入库扫描管道 ==================== */

    @Test
    void scanPipeline_shouldPassWhenOnlyNoopScanner() {
        FileScanPipeline pipeline = new FileScanPipeline(List.of(new NoopVirusScanner()));

        pipeline.assertClean(scanContext(() -> new ByteArrayInputStream(new byte[]{1})));
    }

    @Test
    void scanPipeline_shouldRejectWhenAnyScannerReportsThreat() {
        VirusScanner infectedScanner = new VirusScanner() {
            @Override
            public String scannerId() {
                return "stub-av";
            }

            @Override
            public VirusScanResult scan(VirusScanContext context) {
                return VirusScanResult.infected("EICAR-Test-File");
            }
        };
        FileScanPipeline pipeline = new FileScanPipeline(List.of(new NoopVirusScanner(), infectedScanner));

        assertThatThrownBy(() -> pipeline.assertClean(scanContext(() -> new ByteArrayInputStream(new byte[]{1}))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("EICAR-Test-File")
                // 与分享侧 DLP 拦截同一对外语义：不允许流转（4007），而非「服务器故障请重试」
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(4007);
    }

    @Test
    void scanPipeline_shouldFailClosedWhenScannerThrows() {
        VirusScanner brokenScanner = new VirusScanner() {
            @Override
            public String scannerId() {
                return "broken-av";
            }

            @Override
            public VirusScanResult scan(VirusScanContext context) {
                throw new IllegalStateException("engine down");
            }
        };
        FileScanPipeline pipeline = new FileScanPipeline(List.of(brokenScanner));

        // 引擎故障不得等于「放行」：否则「把杀毒引擎打挂」就成了入库绕过通道
        assertThatThrownBy(() -> pipeline.assertClean(scanContext(() -> new ByteArrayInputStream(new byte[]{1}))))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(4007);
    }

    /* ==================== 装配门禁（@ConditionalOnMissingBean） ==================== */

    @Test
    void ceDefaults_shouldProvideAllThreeSpiBeans() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(VirusScanner.class);
            assertThat(context).hasSingleBean(WatermarkProvider.class);
            assertThat(context).hasSingleBean(CryptoCodec.class);
            assertThat(context.getBean(VirusScanner.class)).isInstanceOf(NoopVirusScanner.class);
            assertThat(context.getBean(WatermarkProvider.class)).isInstanceOf(NoopWatermarkProvider.class);
            assertThat(context.getBean(CryptoCodec.class)).isInstanceOf(PlainCryptoCodec.class);
        });
    }

    @Test
    void eeVirusScanner_shouldTakeOverCeDefault() {
        runner.withBean(VirusScanner.class, StubEeVirusScanner::new)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(VirusScanner.class);
                    assertThat(context.getBean(VirusScanner.class)).isInstanceOf(StubEeVirusScanner.class);
                });
    }

    @Test
    void eeWatermarkAndCodec_shouldTakeOverCeDefaults() {
        runner.withBean(WatermarkProvider.class, StubEeWatermarkProvider::new)
                .withBean(CryptoCodec.class, StubEeCryptoCodec::new)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(WatermarkProvider.class)).isInstanceOf(StubEeWatermarkProvider.class);
                    assertThat(context.getBean(CryptoCodec.class)).isInstanceOf(StubEeCryptoCodec.class);
                    // 未提供实现的接缝仍由 CE 兜底：缺一个实现不得让启动失败
                    assertThat(context.getBean(VirusScanner.class)).isInstanceOf(NoopVirusScanner.class);
                });
    }

    /* ==================== 测试替身 ==================== */

    static class StubEeVirusScanner implements VirusScanner {
        @Override
        public String scannerId() {
            return "ee-stub";
        }

        @Override
        public VirusScanResult scan(VirusScanContext context) {
            return VirusScanResult.clean();
        }
    }

    static class StubEeWatermarkProvider implements WatermarkProvider {
        @Override
        public String providerId() {
            return "ee-stub";
        }

        @Override
        public InputStream wrap(InputStream source, WatermarkContext context) {
            return source;
        }
    }

    static class StubEeCryptoCodec implements CryptoCodec {
        @Override
        public String codecId() {
            return "ee-stub";
        }

        @Override
        public OutputStream encrypt(OutputStream sink, CryptoContext context) {
            return sink;
        }

        @Override
        public InputStream decrypt(InputStream source, CryptoContext context) {
            return source;
        }
    }

    private static WatermarkProvider.WatermarkContext watermarkContext() {
        return new WatermarkProvider.WatermarkContext(1L, "a.txt", 7L, 7L, "alice", false);
    }

    private static VirusScanner.VirusScanContext scanContext(ContentAccess content) {
        return new VirusScanner.VirusScanContext("sha256-abc", "a.txt", "txt", 1L, 7L, content);
    }
}
