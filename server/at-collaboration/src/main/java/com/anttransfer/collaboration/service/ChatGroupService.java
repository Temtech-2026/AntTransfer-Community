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
package com.anttransfer.collaboration.service;

import com.anttransfer.collaboration.model.dto.ChatGroupCreateDTO;
import com.anttransfer.collaboration.model.dto.ChatGroupMemberAddDTO;
import com.anttransfer.collaboration.model.dto.ChatGroupNotifyPreferenceDTO;
import com.anttransfer.collaboration.model.dto.ChatGroupUpdateDTO;
import com.anttransfer.collaboration.model.entity.GroupMember;
import com.anttransfer.collaboration.model.entity.SysGroup;
import com.anttransfer.collaboration.model.vo.ChatGroupAbilityVO;
import com.anttransfer.collaboration.model.vo.ChatGroupDetailVO;
import com.anttransfer.collaboration.model.vo.ChatGroupMemberVO;
import com.anttransfer.collaboration.model.vo.ChatGroupNotifyPreferenceVO;
import com.anttransfer.collaboration.model.vo.ChatGroupVO;
import com.anttransfer.collaboration.repository.ChatGroupRow;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 群聊管理：建群、群详情，以及群组成员关系与群生命的<b>全部写操作</b>
 * （改群名 / 邀请成员 / 移除成员 / 退出群聊 / 解散群）。
 *
 * <p><b>为什么需要建群这个动作：</b>在此之前，{@code sys_group} / {@code sys_group_member}
 * 两张表只被<b>读</b>——发送前校验「是不是成员」、投递时按成员写扩散。系统里没有任何
 * 创建群组的入口，于是聊天弹窗的「群聊」分支只能让用户手填一个群组 ID，
 * 而这样的群组永远不存在；群聊因此在整体上不可用（不是某个操作失败，是入口成死路）。</p>
 *
 * <p><b>为什么群管理面也收在本类：</b>建群之后群在事实上是<b>不可维护</b>的——名字打错了
 * 只能重新建群（历史会话随之作废），人走了还挂在群里、想拉人进来也无处可点。
 * 这些动作与建群共享同一组不变量（群主身份、成员上限、成员资格），
 * 拆到别的类只会让「谁能改这个群」的判定散落在多个文件里。</p>
 *
 * <p><b>建群与发消息的职责边界：</b>本类不碰消息。发送侧的成员校验仍然在
 * {@code ChatService} 里逐次执行——成员关系是「此刻谁在群里」的实时事实，
 * 本类的任何写操作都以它为准，而不是以建群时的初始快照为准。</p>
 *
 * <p><b>两条授权线，缺一不可：</b>
 * <ol>
 *   <li><b>权限点（粗粒度）</b>：{@code chat:group:update} 等由 Controller 的
 *       {@code @RequiresPerm} 强制——回答「这个账号有没有群管理这项功能」，不足则 1003；</li>
 *   <li><b>群内身份（细粒度）</b>：本类逐次校验「你是不是<b>这个</b>群的管理者」，
 *       回答「你有功能权限，但这个群归不归你管」，不足则 1038 / 1041。</li>
 * </ol>
 * 前者要管理员改角色，后者只能找群主，提示与自救动作完全不同，故不可合并成一个码。</p>
 *
 * <p><b>事务边界：</b>建群时群行与全体成员行必须在同一事务里落库。若只落了群行，
 * 会得到一个「没有成员的群」——它的会话任何人都发不进去（含群主自己），
 * 前端表现为「建群成功了，但一发消息就 1012」，比建群失败更难排查。
 * 同理，邀请的「逐个复活 / 新增」、解散的「清成员 + 停群行」也必须整体成败。</p>
 *
 * <p><b>解散的语义取舍：</b>解散 = 群 {@code status} 置 0 + <b>全体成员行逻辑删除</b>。
 * 发送与历史拉取都以 {@code sys_group_member} 为唯一授权依据，清空成员关系一次到位，
 * 解散即终止一切读写，且不新增旁路判定（详见 {@code GroupMemberMapper#markAllDeleted}）。</p>
 *
 * @author AntTransfer CE
 */
@Service
public class ChatGroupService {

    private static final Logger log = LoggerFactory.getLogger(ChatGroupService.class);

    /** 群名长度上限（{@code sys_group.name} 列宽；与 DTO 注解同源，此处兜底非 HTTP 调用方） */
    private static final int NAME_MAX_LENGTH = 64;

    private final SysGroupMapper sysGroupMapper;
    private final GroupMemberMapper groupMemberMapper;
    private final UserLookupPort userLookupPort;

    public ChatGroupService(SysGroupMapper sysGroupMapper,
                            GroupMemberMapper groupMemberMapper,
                            UserLookupPort userLookupPort) {
        this.sysGroupMapper = sysGroupMapper;
        this.groupMemberMapper = groupMemberMapper;
        this.userLookupPort = userLookupPort;
    }

    /**
     * 创建群聊：建群 + 创建者入群为群主 + 受邀成员入群。
     *
     * <p><b>创建者由服务端自动入群</b>，DTO 里的成员列表按「受邀者」理解：
     * 先剔除创建者自己再去重。这样「我建的群我居然不在里面」在数据层不可能发生，
     * 也省掉一个「创建者是否必须在成员列表里」的口径分歧。</p>
     *
     * <p><b>逐个校验受邀成员可用性</b>：与单聊发送前的 {@code existsActiveUser} 同一把尺子。
     * 建群是一次性批量动作，若这里放行已注销 / 已停用的账号，就会造出
     * 「名字挂在群里、却永远读不到消息」的僵尸成员，且事后无人能判断该不该清理。</p>
     *
     * @param creatorId 创建者（取自登录态，不从入参取——否则可冒名建群）
     * @param dto       建群入参（群名 + 受邀成员）
     * @return 新建的群（id 可直接作为群聊会话的 targetId）
     * @throws BusinessException 群名为空 / 过长（PARAM_MISSING、PARAM_ERROR）、
     *                           无有效受邀成员（CHAT_GROUP_MEMBER_REQUIRED）、
     *                           超成员上限（CHAT_GROUP_MEMBER_LIMIT）、
     *                           受邀成员不可用（CHAT_GROUP_MEMBER_INVALID）
     */
    @Transactional
    public ChatGroupVO create(Long creatorId, ChatGroupCreateDTO dto) {
        String name = normalizeName(dto.name());
        Set<Long> invitees = normalizeInvitees(creatorId, dto.memberIds());
        assertInviteesAvailable(invitees);

        SysGroup group = new SysGroup();
        group.setName(name);
        group.setGroupType(SysGroup.TYPE_CHAT);
        group.setOwnerUserId(creatorId);
        group.setStatus(SysGroup.STATUS_ACTIVE);
        group.setCreateBy(creatorId);
        sysGroupMapper.insert(group);

        // 同一批成员用同一个时间戳：入群时间戳若逐个 now()，"同一批邀请"会在审计里
        // 显示成先后加入的两个人，反而是虚假信息
        LocalDateTime joinTime = LocalDateTime.now();
        groupMemberMapper.insert(buildMember(group.getId(), creatorId, GroupMember.ROLE_ADMIN, joinTime));
        for (Long invitee : invitees) {
            groupMemberMapper.insert(buildMember(group.getId(), invitee, GroupMember.ROLE_MEMBER, joinTime));
        }

        long memberCount = invitees.size() + 1L;
        log.info("群聊已创建：groupId={}, owner={}, memberCount={}", group.getId(), creatorId, memberCount);
        return new ChatGroupVO(group.getId(), name, creatorId, memberCount);
    }

    /**
     * 我加入的群（会话目标选择器 / 建群后回显）。
     *
     * <p><b>不挂权限点、登录即用：</b>查询维度写死为调用者本人，且只返回其
     * {@code sys_group_member} 里的群，调用方无法指定别人的用户 ID，
     * 因此不存在「越权列他人群组」的入参面——与 {@code /conversations} 同属
     * 「只看得到自己的」口径。若给它加权限点，默认角色拿不到就会表现为
     * 「建完群却看不到群」，把可用性事故伪装成权限配置问题。</p>
     *
     * @param userId 查询者（取自登录态）
     * @return 我加入的生效群；没加入任何群时返回空列表（前端据此隐藏群聊入口）
     */
    public List<ChatGroupVO> listMine(Long userId) {
        return sysGroupMapper.selectMyGroups(userId).stream()
                .map(ChatGroupService::toVO)
                .toList();
    }

    /* ------------------------------------------------------------------ 群详情 */

    /**
     * 群详情（群配置面板的唯一数据源）。
     *
     * <p><b>不挂权限点，但必须是群成员：</b>与 {@code listMine} 同理，查询维度是「我自己在的群」，
     * 越权面由「非成员 1012」堵住而不是靠权限点。挂上权限点会让「建了群却看不到群资料」
     * 变成一次权限配置事故。</p>
     *
     * @param viewerId 查看者（取自登录态）
     * @param groupId  群 ID
     * @return 群详情（含成员名单与我的可操作项）
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员（CHAT_NOT_GROUP_MEMBER）
     */
    public ChatGroupDetailVO detail(Long viewerId, Long groupId) {
        SysGroup group = requireActiveGroup(groupId);
        return toDetail(group, requireMember(groupId, viewerId));
    }

    /**
     * 读取「我在这个群」的消息提醒偏好（群设置面板的三个开关的初始状态）。
     *
     * <p><b>归属写死为登录人</b>：入参只有群 ID，没有「目标用户」——偏好是 (我, 这个群)
     * 这条成员关系的私有属性（见 {@code V20} 口径），调用方无从读到别人的免打扰设置。</p>
     *
     * <p><b>为什么不挂权限点</b>：与 {@code chat:group:update} 那类「改群」操作不同，
     * 本操作只改自己的接收偏好，不改任何共享状态，也不产生对他人可见的影响，
     * 属「登录即用」的自我配置（同 {@code /contacts/{peerId}/alias} 的取舍）。</p>
     *
     * @param viewerId 登录用户 ID
     * @param groupId  群 ID
     * @return 我的提醒偏好（三态常规化，恒有值）
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员（CHAT_NOT_GROUP_MEMBER）
     */
    public ChatGroupNotifyPreferenceVO notifyPreference(Long viewerId, Long groupId) {
        requireActiveGroup(groupId);
        return toNotifyPreferenceVO(requireMember(groupId, viewerId));
    }

    /**
     * 更新「我在这个群」的消息提醒偏好（免打扰 + 两类提及开关，整体覆盖式）。
     *
     * <p><b>写入用单条 UPDATE 兜底归属，而不是「先查再改」：</b>UPDATE 的
     * {@code where group_id + user_id + deleted = 0} 同时回答了「这个人还在这个群里吗」——
     * 受影响行数为 0 即非成员 / 已退群，直接转 1012。这样「查成员」与「改偏好」之间
     * 不存在可被并发退群撕开的窗口：即使成员关系在两条语句之间被删除，
     * UPDATE 也会落到 0 行并如实拒绝，而不是拿着一份过期的成员快照写进去。</p>
     *
     * <p><b>群存在性单独先判</b>（{@code requireActiveGroup}）：否则「群不存在」会与
     * 「我不是成员」落到同一个 1012，既丢掉了 1008 的可读性，也让「群 ID 是否存在」
     * 无从区分（该区分在群 ID 已由调用方持有时不构成探测风险，见
     * {@code ErrorCode#CHAT_GROUP_NOT_FOUND}）。</p>
     *
     * @param viewerId 登录用户 ID
     * @param groupId  群 ID
     * @param dto      三个开关的完整状态（缺一即被 {@code @NotNull} 拒，见 DTO 注释）
     * @return 落库后的提醒偏好（即本次提交的完整状态）
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员 / 已退群（CHAT_NOT_GROUP_MEMBER）
     */
    @Transactional
    public ChatGroupNotifyPreferenceVO updateNotifyPreference(Long viewerId, Long groupId,
                                                              ChatGroupNotifyPreferenceDTO dto) {
        requireActiveGroup(groupId);
        int muteStatus = toFlag(dto.muteStatus());
        int notifyOnMention = toFlag(dto.notifyOnMention());
        int notifyOnMentionAll = toFlag(dto.notifyOnMentionAll());

        int affected = groupMemberMapper.updateNotifyPreference(
                groupId, viewerId, muteStatus, notifyOnMention, notifyOnMentionAll, viewerId);
        if (affected == 0) {
            throw new BusinessException(ErrorCode.CHAT_NOT_GROUP_MEMBER);
        }

        log.info("群提醒偏好已更新 groupId={} userId={} muteStatus={} notifyOnMention={} notifyOnMentionAll={}",
                groupId, viewerId, muteStatus, notifyOnMention, notifyOnMentionAll);
        return new ChatGroupNotifyPreferenceVO(muteStatus, notifyOnMention, notifyOnMentionAll);
    }

    /**
     * 布尔开关 → 存储取值。免打扰与提及提醒用的是同一套 {@code 0-关 1-开} 刻度
     * （见 {@code GroupMember.MUTE_ON / NOTIFY_ON}），故共用一个转换，不按列各写一份。
     */
    private static int toFlag(Boolean on) {
        return Boolean.TRUE.equals(on) ? 1 : 0;
    }

    /**
     * 修改群名（群主 / 管理员）。
     *
     * <p><b>同名视为成功但不多写一次库：</b>重复提交（双击、重试）不该产生一条
     * 内容相同的 {@code UPDATE}——那会平白刷新 {@code update_time} 与 {@code update_by}，
     * 让审计看不出「这次到底改了什么」。</p>
     *
     * @param operatorId 操作者（取自登录态）
     * @param groupId    群 ID
     * @param dto        新群名
     * @return 变更后的群详情（前端据此直接刷新，无需再发一次 GET）
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员（CHAT_NOT_GROUP_MEMBER）、
     *                           群内身份不足（CHAT_GROUP_ADMIN_REQUIRED）、
     *                           群名为空 / 过长（PARAM_MISSING、PARAM_ERROR）
     */
    @Transactional
    public ChatGroupDetailVO rename(Long operatorId, Long groupId, ChatGroupUpdateDTO dto) {
        SysGroup group = requireActiveGroup(groupId);
        GroupMember me = requireAdmin(group, groupId, operatorId);
        String name = normalizeName(dto.name());
        if (!name.equals(group.getName())) {
            SysGroup patch = new SysGroup();
            patch.setId(groupId);
            patch.setName(name);
            patch.setUpdateBy(operatorId);
            sysGroupMapper.updateById(patch);
            // 回填内存对象，使下方组装的详情反映本次写入（无需再查一次库）
            group.setName(name);
            log.info("群聊已改名：groupId={}, operator={}", groupId, operatorId);
        }
        return toDetail(group, me);
    }

    /**
     * 邀请成员入群（群主 / 管理员），一次可邀多人。
     *
     * <p><b>三条分支决定「怎么落库」：</b>已在群 → 幂等跳过（不算错，也不占本次名额）；
     * 曾被移除（{@code deleted=1} 的行还在）→ 原地复活；从未入群 → 新增。
     * 第二条分支是必需的：唯一键 {@code uk_group_user(group_id, user_id)} 不含 {@code deleted}，
     * 移除后旧行仍占位，直接插入必撞唯一键（详见 {@code GroupMemberMapper} 类注释）。</p>
     *
     * <p><b>上限按「现有 + 新增」判：</b>只判本次入参规模会让「480 人的群再拉 40 人」通过校验，
     * 落库后直接突破发送侧的写扩散上限——故障从邀请时刻推迟到发送时刻，更难定位。</p>
     *
     * @param operatorId 操作者（取自登录态）
     * @param groupId    群 ID
     * @param dto        受邀成员 ID 列表
     * @return 变更后的群详情
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员（CHAT_NOT_GROUP_MEMBER）、
     *                           群内身份不足（CHAT_GROUP_ADMIN_REQUIRED）、
     *                           超出成员上限（CHAT_GROUP_MEMBER_LIMIT）、
     *                           受邀者不存在或不可用（CHAT_GROUP_MEMBER_INVALID）
     */
    @Transactional
    public ChatGroupDetailVO invite(Long operatorId, Long groupId, ChatGroupMemberAddDTO dto) {
        SysGroup group = requireActiveGroup(groupId);
        GroupMember me = requireAdmin(group, groupId, operatorId);

        List<GroupMember> current = groupMemberMapper.selectMembers(groupId);
        Set<Long> existing = new HashSet<>();
        for (GroupMember member : current) {
            existing.add(member.getUserId());
        }

        Set<Long> toAdd = new LinkedHashSet<>();
        if (dto.memberIds() != null) {
            for (Long memberId : dto.memberIds()) {
                if (memberId != null && !existing.contains(memberId)) {
                    toAdd.add(memberId);
                }
            }
        }
        // 全员已在群里：幂等成功，回当前详情（报「重复邀请」会让批量邀请里的其他人白等）
        if (toAdd.isEmpty()) {
            return toDetail(group, me);
        }
        if (current.size() + toAdd.size() > SysGroup.MAX_MEMBERS) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_MEMBER_LIMIT,
                    "群成员数超出上限（最多 " + SysGroup.MAX_MEMBERS + " 人）");
        }
        assertInviteesAvailable(toAdd);

        // 同一批用同一个时间戳：逐个 now() 会把「同一批邀请」在审计里显示成先后加入，
        // 与建群保持同一口径
        LocalDateTime joinTime = LocalDateTime.now();
        for (Long invitee : toAdd) {
            GroupMember removed = groupMemberMapper.selectMemberIncludingDeleted(groupId, invitee);
            if (removed != null) {
                groupMemberMapper.markRestored(removed.getId(), GroupMember.ROLE_MEMBER,
                        joinTime, operatorId);
            } else {
                groupMemberMapper.insert(
                        buildMember(groupId, invitee, GroupMember.ROLE_MEMBER, joinTime));
            }
        }
        log.info("群成员已邀请：groupId={}, operator={}, addedCount={}",
                groupId, operatorId, toAdd.size());
        return toDetail(group, me);
    }

    /**
     * 移除群成员（仅群主）。
     *
     * <p><b>为什么移除不交给管理员：</b>移除是不可逆的成员关系破坏（被移除者立刻
     * 读不到历史、发不进消息），而改群名 / 邀请则可逆且高频。CE 把「破坏性」与「日常性」
     * 分给群主与管理员两档。</p>
     *
     * @param operatorId   操作者（取自登录态）
     * @param groupId      群 ID
     * @param targetUserId 被移除者
     * @return 变更后的群详情
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员（CHAT_NOT_GROUP_MEMBER）、
     *                           非群主（CHAT_GROUP_OWNER_REQUIRED）、
     *                           目标不存在于该群（CHAT_GROUP_MEMBER_NOT_FOUND）、
     *                           目标是群主本身（CHAT_GROUP_OWNER_CANNOT_QUIT）
     */
    @Transactional
    public ChatGroupDetailVO removeMember(Long operatorId, Long groupId, Long targetUserId) {
        SysGroup group = requireActiveGroup(groupId);
        GroupMember me = requireOwner(group, groupId, operatorId);
        if (targetUserId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "成员 ID 不能为空");
        }
        // 群主不可被移除（含「群主移除自己」）：那条路会造出一个没有所有者的群，
        // 此后无人能改群名 / 邀请 / 解散——群主想离开只能先解散
        if (targetUserId.equals(group.getOwnerUserId())) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_OWNER_CANNOT_QUIT);
        }
        GroupMember target = groupMemberMapper.selectMember(groupId, targetUserId);
        if (target == null) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_MEMBER_NOT_FOUND);
        }
        groupMemberMapper.markDeleted(target.getId(), operatorId);
        log.info("群成员已移除：groupId={}, operator={}, target={}", groupId, operatorId, targetUserId);
        return toDetail(group, me);
    }

    /**
     * 退出群聊（任何非群主成员；<b>不挂权限点</b>）。
     *
     * <p><b>为什么退群不需要权限点：</b>它只能作用于「我自己」这一行，
     * 入参里没有任何指向他人的 ID，越权面为零。若挂上权限点，未授权的角色会
     * 「加入了群却退不出去」——只能求管理员从后台删数据。</p>
     *
     * <p><b>退出后读不到历史是既定口径：</b>发送与历史拉取都只认 {@code sys_group_member}，
     * 退群即失去该群全部读取权限。会话列表里的历史项会随之变成 1012（前端提示退出/被移除），
     * 这与「成员资格是唯一授权依据」这一不变式一致——不能为了让人看旧消息而开出旁路。</p>
     *
     * @param userId  退群者（取自登录态）
     * @param groupId 群 ID
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员（CHAT_NOT_GROUP_MEMBER）、
     *                           群主不能退群（CHAT_GROUP_OWNER_CANNOT_QUIT）
     */
    @Transactional
    public void quit(Long userId, Long groupId) {
        SysGroup group = requireActiveGroup(groupId);
        GroupMember me = requireMember(groupId, userId);
        if (isOwner(group, userId)) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_OWNER_CANNOT_QUIT);
        }
        groupMemberMapper.markDeleted(me.getId(), userId);
        log.info("已退出群聊：groupId={}, userId={}", groupId, userId);
    }

    /**
     * 解散群聊（仅群主），不可逆。
     *
     * <p><b>为什么先清成员、后停群行：</b>反过来的中间态是「群已停用、成员行仍在」，
     * 而发送侧只认成员行、不看群状态——并发下就能往一个已解散的群里写进消息。
     * 先清成员则中间态是「群还在、但已无人是成员」，发送侧一律 1012，安全。</p>
     *
     * @param operatorId 操作者（取自登录态）
     * @param groupId    群 ID
     * @throws BusinessException 群不存在 / 已解散（CHAT_GROUP_NOT_FOUND）、
     *                           我不是该群成员（CHAT_NOT_GROUP_MEMBER）、
     *                           非群主（CHAT_GROUP_OWNER_REQUIRED）
     */
    @Transactional
    public void dissolve(Long operatorId, Long groupId) {
        SysGroup group = requireActiveGroup(groupId);
        requireOwner(group, groupId, operatorId);
        groupMemberMapper.markAllDeleted(groupId, operatorId);
        SysGroup patch = new SysGroup();
        patch.setId(groupId);
        patch.setStatus(SysGroup.STATUS_DISABLED);
        patch.setUpdateBy(operatorId);
        sysGroupMapper.updateById(patch);
        log.info("群聊已解散：groupId={}, operator={}", groupId, operatorId);
    }

    /* ------------------------------------------------------------------ 内部实现 */

    private static ChatGroupVO toVO(ChatGroupRow row) {
        return new ChatGroupVO(row.getId(), row.getName(), row.getOwnerUserId(),
                row.getMemberCount() == null ? 0L : row.getMemberCount());
    }

    /** 群名归一：去首尾空白后判空与长度（空白群名在前端表现为「建了个看不见名字的群」）。 */
    private static String normalizeName(String rawName) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "群聊名称不能为空");
        }
        if (name.length() > NAME_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "群聊名称过长");
        }
        return name;
    }

    /**
     * 受邀成员归一：剔除空值与创建者、按传入顺序去重，再校验规模。
     *
     * <p>用 {@link LinkedHashSet} 而非 {@code HashSet}：成员数不敏感，
     * 但落库顺序（进而自增 ID 顺序）保持与用户勾选顺序一致，
     * 排查时「谁先入群」不需要再去翻时间戳。</p>
     */
    private static Set<Long> normalizeInvitees(Long creatorId, List<Long> memberIds) {
        Set<Long> invitees = new LinkedHashSet<>();
        if (memberIds != null) {
            for (Long memberId : memberIds) {
                if (memberId != null && !memberId.equals(creatorId)) {
                    invitees.add(memberId);
                }
            }
        }
        if (invitees.isEmpty()) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_MEMBER_REQUIRED);
        }
        // +1 是创建者（群主）：上限是「群的总人数」，不是「受邀人数」
        if (invitees.size() + 1 > SysGroup.MAX_MEMBERS) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_MEMBER_LIMIT,
                    "群成员数超出上限（最多 " + SysGroup.MAX_MEMBERS + " 人）");
        }
        return invitees;
    }

    /** 逐个校验受邀成员是否存在且可用；失败即整体回滚（不留半个群）。 */
    private void assertInviteesAvailable(Set<Long> invitees) {
        for (Long invitee : invitees) {
            if (!userLookupPort.existsActiveUser(invitee)) {
                throw new BusinessException(ErrorCode.CHAT_GROUP_MEMBER_INVALID,
                        "邀请的成员不存在或不可用");
            }
        }
    }

    private static GroupMember buildMember(Long groupId, Long userId, int memberRole,
                                           LocalDateTime joinTime) {
        GroupMember member = new GroupMember();
        member.setGroupId(groupId);
        member.setUserId(userId);
        member.setMemberRole(memberRole);
        member.setJoinTime(joinTime);
        member.setCreateBy(userId);
        return member;
    }

    /* ------------------------------------------------- 群管理面的身份与详情 */

    /**
     * 取生效群：不存在 / 已逻辑删除 / 已解散（{@code status=0}）一律 1037。
     *
     * <p><b>为什么合并三种情况：</b>分开报会给出「这个群 ID 是否存在」的探测面
     * （见 {@code ErrorCode#CHAT_GROUP_NOT_FOUND} 注释）。</p>
     */
    private SysGroup requireActiveGroup(Long groupId) {
        if (groupId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "群 ID 不能为空");
        }
        SysGroup group = sysGroupMapper.selectById(groupId);
        if (group == null || group.getStatus() == null
                || group.getStatus() != SysGroup.STATUS_ACTIVE) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_NOT_FOUND);
        }
        return group;
    }

    /** 取我的成员行；非成员 1012——与发送 / 历史拉取同一把尺子，不另立口径。 */
    private GroupMember requireMember(Long groupId, Long userId) {
        GroupMember me = groupMemberMapper.selectMember(groupId, userId);
        if (me == null) {
            throw new BusinessException(ErrorCode.CHAT_NOT_GROUP_MEMBER);
        }
        return me;
    }

    /** 群主或管理员；不足 1038。 */
    private GroupMember requireAdmin(SysGroup group, Long groupId, Long userId) {
        GroupMember me = requireMember(groupId, userId);
        if (!isOwner(group, userId) && !isAdmin(me)) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_ADMIN_REQUIRED);
        }
        return me;
    }

    /** 仅群主；不足 1041。 */
    private GroupMember requireOwner(SysGroup group, Long groupId, Long userId) {
        GroupMember me = requireMember(groupId, userId);
        if (!isOwner(group, userId)) {
            throw new BusinessException(ErrorCode.CHAT_GROUP_OWNER_REQUIRED);
        }
        return me;
    }

    /**
     * 是否群主。
     *
     * <p><b>权威源是 {@code sys_group.owner_user_id}，不是成员行的 {@code member_role}：</b>
     * 群主恒有一条 {@code ROLE_ADMIN} 成员行，但 {@code ROLE_ADMIN} 也可能给到别的成员，
     * 二者不是双射。以 owner 列为准，将来支持转让群主时只需改这一列，
     * 不必同步刷两处角色。</p>
     */
    private static boolean isOwner(SysGroup group, Long userId) {
        return userId != null && userId.equals(group.getOwnerUserId());
    }

    private static boolean isAdmin(GroupMember me) {
        return me.getMemberRole() != null && me.getMemberRole() == GroupMember.ROLE_ADMIN;
    }

    /**
     * 组装群详情。
     *
     * <p><b>展示名一次性批量反查：</b>{@code findContacts} 一次拿全，
     * 不在循环里逐个查——500 人的群逐次反查就是 500 次往返。</p>
     *
     * <p>能力布尔在此按<b>群内身份</b>算出（见 {@code ChatGroupAbilityVO}）：
     * 权限点维度由前端 {@code useAccess} 与服务端 {@code @RequiresPerm} 各管一半，
     * 两者取「与」才是最终能否操作。</p>
     */
    private ChatGroupDetailVO toDetail(SysGroup group, GroupMember me) {
        List<GroupMember> rows = groupMemberMapper.selectMembers(group.getId());
        Map<Long, UserLookupPort.UserContact> contacts =
                userLookupPort.findContacts(rows.stream().map(GroupMember::getUserId).toList());

        Long viewerId = me.getUserId();
        boolean owner = isOwner(group, viewerId);
        boolean admin = owner || isAdmin(me);

        List<ChatGroupMemberVO> members = rows.stream()
                .map(row -> new ChatGroupMemberVO(
                        row.getUserId(),
                        displayName(contacts, row.getUserId()),
                        avatarUrl(contacts, row.getUserId()),
                        row.getMemberRole() == null ? GroupMember.ROLE_MEMBER : row.getMemberRole(),
                        isOwner(group, row.getUserId()),
                        row.getJoinTime()))
                .toList();

        return new ChatGroupDetailVO(
                group.getId(),
                group.getName(),
                group.getOwnerUserId(),
                members.size(),
                SysGroup.MAX_MEMBERS,
                new ChatGroupAbilityVO(admin, admin, owner, owner, !owner, owner),
                members,
                toNotifyPreferenceVO(me));
    }

    /**
     * 把「我的成员行」投影成提醒偏好视图（三个开关都归一成 {@code 0/1}，不吐 {@code null}）。
     *
     * <p>{@code null} 只会出现在「{@code V20} 迁移前落库的成员行」上，而迁移脚本已给存量行
     * 填了默认值；此处仍逐一兜底，使对外契约恒为三态取值，前端不必对每个开关再写一次
     * {@code null} 判空（口径同 {@code NotifyMessage#mentionTypeOrDefault}）。</p>
     */
    private static ChatGroupNotifyPreferenceVO toNotifyPreferenceVO(GroupMember me) {
        return new ChatGroupNotifyPreferenceVO(
                me.isMuted() ? GroupMember.MUTE_ON : GroupMember.MUTE_OFF,
                me.isNotifyOnMentionEnabled() ? GroupMember.NOTIFY_ON : GroupMember.NOTIFY_OFF,
                me.isNotifyOnMentionAllEnabled() ? GroupMember.NOTIFY_ON : GroupMember.NOTIFY_OFF);
    }

    /**
     * 展示名回落：查不到（账号已删除 / 已禁用）返回 {@code null}，
     * 由前端按 i18n 文案回落「未知成员」。服务端不编造占位文案——那是展示层的职责，
     * 且要随语言切换。
     */
    private static String displayName(Map<Long, UserLookupPort.UserContact> contacts, Long userId) {
        UserLookupPort.UserContact contact = contacts.get(userId);
        return contact == null ? null : contact.displayName();
    }

    /**
     * 成员头像回落：与 {@link #displayName} <b>同源同命运</b>——账号查不到时两者一起为 {@code null}，
     * 前端用展示名首字符画兜底圆。只有名字没有头像（空圆）或只有头像没有名字（匿名头像）
     * 都会让成员列表看起来像坏了，所以这两个字段必须由同一次反查给出。
     *
     * <p>复用调用方已批量查好的 {@code contacts}，不额外查询。</p>
     */
    private static String avatarUrl(Map<Long, UserLookupPort.UserContact> contacts, Long userId) {
        UserLookupPort.UserContact contact = contacts.get(userId);
        return contact == null ? null : contact.avatarUrl();
    }
}
