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
package com.anttransfer.gateway.transport;

import com.anttransfer.common.spi.transport.TransportStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 传输协议策略注册表：装配期校验 + 运行期选择。
 *
 * <p><b>为什么要有这个类（而不是只放一个 {@code HttpTransportStrategy} Bean）</b>：
 * {@code TransportStrategy} 是 SPI——「能力差异由 Bean 是否存在表达」。若没有任何读取方，
 * 这类接缝就只是「看起来留了口子」，EE 接入时仍要先发明一套聚合逻辑。注册表把「去重校验」
 * 与「按请求选协议」这两件每次接入都要重写的事固定下来，EE 只需声明自己的实现 Bean。</p>
 *
 * <p><b>装配期校验（重复协议即拒绝启动）</b>：同一 {@code protocol()} 有两个实现时，
 * 「谁生效」取决于 Bean 顺序而不是声明意图——这属于配置错误，必须在启动时炸出来，
 * 而不是让某次请求悄悄走了另一个实现。{@code protocol()} 缺失同样按配置错误处理。</p>
 *
 * <p><b>CE 行为</b>：容器内只有 {@code HttpTransportStrategy}，本类对其无感，不做任何协议协商分支
 * ——{@code select} 由 EE 侧接线方调用；CE 的对外 URL 仍由 HTTP 端点直接给出。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class TransportStrategyRegistry {

    private static final Logger log = LoggerFactory.getLogger(TransportStrategyRegistry.class);

    private final List<TransportStrategy> strategies;
    private final List<String> protocols;

    public TransportStrategyRegistry(List<TransportStrategy> strategies) {
        List<TransportStrategy> ordered = new ArrayList<>(strategies);
        ordered.sort(AnnotationAwareOrderComparator.INSTANCE);

        Map<String, TransportStrategy> byProtocol = new LinkedHashMap<>();
        for (TransportStrategy strategy : ordered) {
            String protocol = normalize(strategy);
            TransportStrategy existing = byProtocol.putIfAbsent(protocol, strategy);
            if (existing != null) {
                throw new IllegalStateException("传输协议策略重复注册，装配拒绝启动：protocol=" + protocol
                        + "，冲突实现=" + existing.getClass().getName()
                        + " 与 " + strategy.getClass().getName()
                        + "（同一协议只允许一个实现，请删除其一或改用不同 protocol()）");
            }
        }

        this.strategies = List.copyOf(ordered);
        this.protocols = List.copyOf(byProtocol.keySet());
        log.info("[gateway] 传输协议策略已装配 {} 个: {}", protocols.size(), protocols);
    }

    /** 按 {@code @Order} 排序后的全部策略（只读） */
    public List<TransportStrategy> strategies() {
        return strategies;
    }

    /** 当前可用的协议标识（去重后的声明顺序） */
    public List<String> availableProtocols() {
        return protocols;
    }

    /**
     * 为给定请求上下文选择首个声明支持的策略。
     *
     * @return 命中的策略；无匹配时为空（CE 装配下不应发生，HTTP 策略覆盖 http/https/未知 scheme）
     */
    public Optional<TransportStrategy> select(TransportStrategy.TransportRequest request) {
        for (TransportStrategy strategy : strategies) {
            if (strategy.supports(request)) {
                return Optional.of(strategy);
            }
        }
        log.debug("没有传输策略认领本次请求：scheme={}, protocols={}",
                request == null ? null : request.scheme(), protocols);
        return Optional.empty();
    }

    private static String normalize(TransportStrategy strategy) {
        String protocol = strategy.protocol();
        if (!StringUtils.hasText(protocol)) {
            throw new IllegalStateException("传输协议策略未声明 protocol()，装配拒绝启动：impl="
                    + strategy.getClass().getName());
        }
        return protocol.trim().toLowerCase();
    }
}
