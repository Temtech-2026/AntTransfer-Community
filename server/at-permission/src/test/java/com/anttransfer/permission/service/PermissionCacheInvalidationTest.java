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
package com.anttransfer.permission.service;

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.permission.config.PermissionProperties;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.PermissionModels.RoleGrant;
import com.anttransfer.permission.repository.RbacAccessMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@link PermissionService#invalidate(Long)} 的失效语义（R-16 / 越权用例 TC-V-08）。
 *
 * <p><b>为什么「被调用」不等于「真失效」：</b>写路径断言（{@code UserAdminServiceTest} 等）
 * 只能证明「有人调了 invalidate」，而 {@code invalidate} 本身若删错键、吞掉异常前先抛出、
 * 或压根没删到缓存，写路径的用例照样全绿——权限却仍从旧快照放行。故这里把
 * <b>键的精确性</b>与<b>失效后必须回源</b>两件事分开钉死。</p>
 *
 * <p>为了让「缓存真的生效」可观测，本类不把 Redis 换成「永远 miss 的 mock」，
 * 而是用 Map 支撑的假 {@link StringRedisTemplate}：命中与 miss 都能被验证。
 * 由此可以断言「失效前第二次 resolve 不查库、失效后必须查库」这条链路。</p>
 *
 * <p><b>诚实边界：</b>这是单元链路，不是端到端。真 Redis 下「键被删除 → 过滤器链上的旧
 * token 立刻 403」仍需集成测试/DAST 证据，本类不能替代它（见《越权测试用例》§5 遗留）。</p>
 *
 * @author AntTransfer CE
 */
@DisplayName("权限缓存失效 · 键精确性 / 失效后回源 / 降级不抛")
class PermissionCacheInvalidationTest {

    private final Map<String, String> store = new HashMap<>();

    /** Map 支撑的假 Redis：get / set / delete 都真的落到 store 上，便于观察命中与失效。 */
    private StringRedisTemplate inMemoryRedis() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        lenient().when(redis.opsForValue()).thenReturn(ops);
        lenient().when(ops.get(anyString())).thenAnswer(inv -> store.get(inv.getArgument(0)));
        lenient().doAnswer(inv -> {
            store.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(ops).set(anyString(), anyString(), any(Duration.class));
        lenient().doAnswer(inv -> store.remove(inv.getArgument(0)) != null)
                .when(redis).delete(anyString());
        return redis;
    }

    private PermissionService service(RbacAccessMapper mapper, StringRedisTemplate redis) {
        return new PermissionService(mapper, new PermissionProperties(), redis, new ObjectMapper());
    }

    @Test
    @DisplayName("invalidate 精确删除该用户的缓存键，且不误删他人")
    void invalidate_shouldDeleteExactlyOneKeyOfTargetUser() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        PermissionService service = service(mock(RbacAccessMapper.class), redis);

        service.invalidate(42L);

        assertThat(RedisKeyConstants.permKey(42L)).isEqualTo("at:perm:42");
        ArgumentCaptor<String> deletedKeys = ArgumentCaptor.forClass(String.class);
        verify(redis).delete(deletedKeys.capture());
        assertThat(deletedKeys.getAllValues())
                .as("删键必须是 at:perm:{userId} 且只删这一个——删错键等于失效静默失效，"
                        + "而写路径的 verify(invalidate) 仍会通过")
                .containsExactly(RedisKeyConstants.permKey(42L));
    }

    @Test
    @DisplayName("失效后旧快照不得被复用：下一次解析必须回源 DB 重算")
    void afterInvalidate_resolveMustReloadFromDb() {
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(7L)).thenReturn(List.of(new RoleGrant("USER", 1)));
        when(mapper.selectPermCodes(7L)).thenReturn(List.of("file:upload"));
        PermissionService service = service(mapper, inMemoryRedis());

        assertThat(service.resolve(7L).permCodes()).containsExactly("file:upload");
        assertThat(service.resolve(7L).permCodes()).containsExactly("file:upload");
        verify(mapper, times(1)).selectPermCodes(7L);
        assertThat(store).as("解析结果必须真的落进缓存，否则下面的「回源」断言不成立").isNotEmpty();

        service.invalidate(7L);

        assertThat(service.resolve(7L).permCodes()).containsExactly("file:upload");
        verify(mapper, times(2)).selectPermCodes(7L);
    }

    @Test
    @DisplayName("TC-V-08 单元链路：权限回收 + 缓存失效后，旧快照立刻不再放行（403/1003）")
    void revokedPermAfterInvalidate_mustNotBeGrantedFromStaleCache() {
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(9L)).thenReturn(List.of(new RoleGrant("USER", 1)));
        when(mapper.selectPermCodes(9L)).thenReturn(List.of("audit:log:read"));
        PermissionService service = service(mapper, inMemoryRedis());

        AccessSnapshot before = service.resolve(9L);
        service.requirePerm(List.of("audit:log:read"), false, "", before);

        // 管理员回收权限：DB 不再返回该权限点，并触发主动失效（AfterCommitUtils 之后真正执行的那一步）
        when(mapper.selectPermCodes(9L)).thenReturn(List.of());
        service.invalidate(9L);

        AccessSnapshot after = service.resolve(9L);
        assertThat(after.permCodes()).as("失效后重算必须反映回收结果，而不是缓存里的旧并集").isEmpty();
        assertThatThrownBy(() -> service.requirePerm(List.of("audit:log:read"), false, "", after))
                .as("缓存未失效时这里会静默放行——这正是 TC-V-08 要拦的形态")
                .isInstanceOfSatisfying(AuthException.class, e -> assertThat(e.getErrorCode().getCode())
                        .as("必须是 403(1003) 策略 D；1001/1006 会让前端跳登录，把授权问题伪装成未登录")
                        .isEqualTo(1003));
    }

    @Test
    @DisplayName("Redis 抖动不得把失效失败抛给调用方，也不得顺手多查一次 DB")
    void invalidate_shouldSwallowRedisFailureAndNotTouchDb() {
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        doThrow(new RedisConnectionFailureException("redis down")).when(redis).delete(anyString());
        PermissionService service = service(mapper, redis);

        assertThatCode(() -> service.invalidate(1L))
                .as("失效失败若上抛，已提交的授权变更会以「操作失败」回给管理员，"
                        + "而权限实际上已改——这是最难排查的一类不一致")
                .doesNotThrowAnyException();
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("缓存反序列化失败（版本变更）按 miss 处理：回源 DB 而非放行空权限集")
    void corruptCacheEntry_mustFallBackToDb() {
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(5L)).thenReturn(List.of(new RoleGrant("USER", 1)));
        when(mapper.selectPermCodes(5L)).thenReturn(List.of("file:upload"));
        StringRedisTemplate redis = inMemoryRedis();
        store.put(RedisKeyConstants.permKey(5L), "{not-json");

        PermissionService service = service(mapper, redis);

        assertThat(service.resolve(5L).permCodes())
                .as("脏缓存必须回源，不得当成「无权限」或「放行一切」")
                .containsExactly("file:upload");
        verify(mapper).selectPermCodes(5L);
    }
}
