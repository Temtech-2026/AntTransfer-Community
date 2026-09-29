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
package com.anttransfer.file.config;

import com.anttransfer.common.spi.crypto.CryptoCodec;
import com.anttransfer.common.spi.scan.VirusScanner;
import com.anttransfer.common.spi.watermark.WatermarkProvider;
import com.anttransfer.file.extension.NoopVirusScanner;
import com.anttransfer.file.extension.NoopWatermarkProvider;
import com.anttransfer.file.extension.PlainCryptoCodec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * at-file 差异化扩展点的 CE 默认装配（病毒扫描 / 水印 / 存储编解码）。
 *
 * <p>{@code @ConditionalOnMissingBean} 保证 EE 一旦提供自己的实现，CE 直通实现自动让位，
 * <b>无需修改业务代码、也无需删除本类</b>；同时保证「一份配置都不加」的 CE 部署一定能启动
 * （三个接缝都必有 Bean，不存在启动期缺实现的 {@code NoSuchBeanDefinitionException}）。</p>
 *
 * <p>不做任何 {@code if (eeEnabled)} 式分支：能力差异只由「Bean 是否存在」表达。</p>
 *
 * @author AntTransfer CE
 */
@Configuration(proxyBeanMethods = false)
public class FileSpiConfig {

    /** CE 默认：无杀毒引擎，入库扫描恒放行（不读内容） */
    @Bean
    @ConditionalOnMissingBean(VirusScanner.class)
    public VirusScanner noopVirusScanner() {
        return new NoopVirusScanner();
    }

    /** CE 默认：无水印，下发流原样透传 */
    @Bean
    @ConditionalOnMissingBean(WatermarkProvider.class)
    public WatermarkProvider noopWatermarkProvider() {
        return new NoopWatermarkProvider();
    }

    /** CE 默认：不加密，落盘字节与接入前逐字节一致 */
    @Bean
    @ConditionalOnMissingBean(CryptoCodec.class)
    public CryptoCodec plainCryptoCodec() {
        return new PlainCryptoCodec();
    }
}
