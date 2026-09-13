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
package com.anttransfer.collaboration.config;

import com.anttransfer.collaboration.ws.WsRedisSubscriber;
import com.anttransfer.collaboration.ws.WsSessionRegistry;
import com.anttransfer.common.constant.RedisKeyConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * Redis Pub/Sub 订阅装配：把本实例接入 {@code at:ws:channel}，实现跨实例帧扇出。
 *
 * <p><b>为什么必须有这个容器：</b>{@code WsBroadcaster.push} 只负责「往频道发」，
 * 不负责「自己收」——本机的连接同样要通过订阅回环才能收到（见
 * {@code WsBroadcaster} 类注：统一走 Redis 保证单实例与集群行为一致）。
 * 少了这一环，单机部署下同实例内的推送会静默失效——这是最容易漏、且本地自测才会发现的坑。</p>
 *
 * <p><b>容器生命周期：</b>{@code RedisMessageListenerContainer} 由 Spring 托管，
 * 应用启动即建立订阅连接并持续重连；Redis 短暂不可用时它自动重试，
 * 不阻塞应用启动（订阅失败不影响站内消息落库与 REST 可用）。</p>
 *
 * <p><b>单订阅者：</b>整个应用只注册这一个订阅者，避免同一实例重复消费导致
 * 「同一帧发多次」——注册表按用户投递到其全部连接，重复订阅会让每个标签页收到多份。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
public class WsRedisSubscriberConfig {

    @Bean
    public WsRedisSubscriber wsRedisSubscriber(WsSessionRegistry wsSessionRegistry,
                                               ObjectMapper objectMapper) {
        return new WsRedisSubscriber(wsSessionRegistry, objectMapper);
    }

    @Bean
    public RedisMessageListenerContainer wsRedisMessageListenerContainer(
            RedisConnectionFactory redisConnectionFactory,
            WsRedisSubscriber wsRedisSubscriber) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(redisConnectionFactory);
        container.addMessageListener(wsRedisSubscriber, new ChannelTopic(RedisKeyConstants.WS_CHANNEL));
        return container;
    }
}
