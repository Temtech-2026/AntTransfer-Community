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
package com.anttransfer.collaboration.controller;

import com.anttransfer.collaboration.model.dto.ChatGroupCreateDTO;
import com.anttransfer.collaboration.model.dto.ChatGroupMemberAddDTO;
import com.anttransfer.collaboration.model.dto.ChatGroupUpdateDTO;
import com.anttransfer.collaboration.model.dto.ChatSendDTO;
import com.anttransfer.collaboration.model.vo.ChatGroupDetailVO;
import com.anttransfer.collaboration.model.vo.ChatGroupVO;
import com.anttransfer.collaboration.model.vo.ChatPresenceVO;
import com.anttransfer.collaboration.model.vo.ChatTargetVO;
import com.anttransfer.collaboration.model.vo.ConversationVO;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.security.CurrentUserContext;
import com.anttransfer.collaboration.service.ChatGroupService;
import com.anttransfer.collaboration.service.ChatService;
import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.Result;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 单聊 / 群聊端点：发送、历史、已读，以及群组管理（改群名 / 邀请 / 移除 / 退群 / 解散）。
 *
 * <p><b>为什么发送走 HTTP 而不是 WebSocket：</b>发送是「必须可靠」的写操作——
 * 需要落库、需要幂等键、需要在失败时把明确错误码（1012 非群成员 / 1013 目标无效）返回给调用方。
 * WebSocket 帧没有响应与重试语义，用它发送就必须在应用层重新发明 ACK、超时与去重；
 * 而 HTTP 天然具备这三样。实时性由「发送后服务端反向推送」保证：
 * <b>HTTP 上行、WebSocket 下行</b>，各用其长。</p>
 *
 * <p>因此 {@code POST /messages} 成功后，接收方（含发送方其他端）会通过 WebSocket
 * 收到 {@code CHAT} 帧；调用方无需再轮询。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/chat")
public class ChatController {

    private final ChatService chatService;
    private final ChatGroupService chatGroupService;

    public ChatController(ChatService chatService, ChatGroupService chatGroupService) {
        this.chatService = chatService;
        this.chatGroupService = chatGroupService;
    }

    /** 发送会话消息（文本 / 文件传输通知 / 审批结果通知）。 */
    @PostMapping("/messages")
    public Result<NotifyMessageVO> send(@Valid @RequestBody ChatSendDTO dto) {
        return Result.ok(chatService.send(CurrentUserContext.currentUserId(), dto));
    }

    /**
     * 解析单聊目标：把登录账号（或用户 ID）翻译成可发起会话的对端。
     *
     * <p><b>为什么需要这个端点：</b>「发送 / 历史 / 已读」都以 19 位雪花 ID 形式的
     * {@code targetId} 为前提，而普通用户拿不到别人的 ID——用户目录端点
     * （{@code /v1/system/users}）挂在系统管理面的 {@code system:user:list} 上，只有管理员可用。
     * 于是「发起会话」对非管理员实际不可用：既搜不到人，也无从知道该填什么。
     * 本端点把「人记得住的登录账号」翻译成会话目标，使发起会话不再依赖管理面权限。</p>
     *
     * <p><b>不挂权限点、登录即用</b>：与 {@code /conversations} 同理——它不返回任何他人的私有数据，
     * 只回答「这个账号对应哪个用户、他叫什么」；且必须<b>先知道对方账号</b>才能问
     * （精确匹配，不是模糊检索，不提供目录枚举面）。抗账号爆破由 {@code @RateLimit} 承担。</p>
     *
     * <p>解析不到可用用户统一返回 1013（与发送时的目标校验同码），
     * 避免用「账号不存在」与「账号不可用」的差异拼出账号存在性清单。</p>
     *
     * @param query 对方登录账号，或用户 ID（服务端按「账号优先」顺序解析）
     */
    @GetMapping("/targets/resolve")
    @RateLimit(windowSeconds = 60, max = 30, key = "chat-target-resolve",
            message = "查找会话目标过于频繁，请稍后再试")
    public Result<ChatTargetVO> resolveTarget(@RequestParam String query) {
        return Result.ok(chatService.resolvePrivateTarget(query));
    }

    /**
     * 会话历史（倒序，向上翻页）。
     *
     * @param scope    1-单聊（targetId=对端用户 ID）；2-群聊（targetId=群组 ID）
     * @param targetId 会话目标
     * @param beforeId 游标：只返回 id 小于它的消息（首页不传）
     * @param limit    条数（服务端按 {@code notify.chat-history-limit} 收敛上限）
     */
    @GetMapping("/messages")
    public Result<List<NotifyMessageVO>> history(
            @RequestParam Integer scope,
            @RequestParam Long targetId,
            @RequestParam(required = false) Long beforeId,
            @RequestParam(required = false) Integer limit) {
        return Result.ok(chatService.history(
                CurrentUserContext.currentUserId(), scope, targetId, beforeId, limit));
    }

    /**
     * 会话已读（进入会话即调用，清该会话角标）。
     *
     * @return 本次置读条数
     */
    @PostMapping("/read")
    public Result<Integer> markRead(@RequestParam Integer scope, @RequestParam Long targetId) {
        return Result.ok(chatService.markRead(CurrentUserContext.currentUserId(), scope, targetId));
    }

    /**
     * 撤回会话消息（仅发送人本人、仅 2 分钟内）。
     *
     * <p><b>为什么按客户端消息 ID 撤回而不是消息 id：</b>写扩散下同一条消息在每个参与人那里
     * 是不同的行，客户端手中唯一能跨端指认一条消息的键就是它的幂等键
     * （见 {@code ChatRecallVO}）。服务端据此定位该逻辑消息的<b>全部行</b>一起翻转——
     * 只撤自己那一行等于「我撤了、对方还看得到」。</p>
     *
     * <p><b>不挂权限点、登录即用</b>：与 {@code /read} 同口径——作用范围由服务端写死为
     * 「登录人自己发出的消息」（{@code sender_user_id = 当前登录人}），
     * 调用方既撤不掉别人的消息，也没有任何入参可以扩大撤回范围。
     * 若加权限点，默认角色会「连自己打错的字都改不掉」，那是可用性事故而非安全边界。</p>
     *
     * <p>归属与时间窗都在服务端判定并各有其码：超窗 {@code 1034}、不存在或非本人 {@code 1035}；
     * 已是撤回态时按幂等成功返回，以适配多端并发与弱网重试。</p>
     *
     * @param clientMsgId 被撤回消息的幂等键（客户端消息 ID）
     */
    @PostMapping("/messages/recall")
    @RateLimit(windowSeconds = 60, max = 30, key = "chat-recall",
            message = "撤回操作过于频繁，请稍后再试")
    public Result<Void> recall(@RequestParam String clientMsgId) {
        chatService.recall(CurrentUserContext.currentUserId(), clientMsgId);
        return Result.ok();
    }

    /**
     * 会话列表（聊天页左侧栏）。
     *
     * <p><b>为什么需要这个端点：</b>「发送 / 历史 / 已读」都以「已知 scope + targetId」为前提，
     * 而前端最初的困境恰恰是<b>不知道有哪些会话</b>——收件箱分页按产品口径排除了会话消息，
     * 离线补拉只给纯提醒类。本端点补上这一环，聊天页才可能落地。</p>
     *
     * <p><b>不挂权限点、登录即用</b>：查询维度写死为登录人本人（{@code CurrentUserContext}），
     * 调用方无法指定别人的收件人 ID，因此不存在「越权读他人会话」的入参面；
     * 这与 {@code /notifications}、{@code /messages} 的「只看得到自己的」口径一致。</p>
     *
     * @param limit 条数（服务端按 {@code notify.chat-conversation-limit} 收敛上限）
     */
    @GetMapping("/conversations")
    public Result<List<ConversationVO>> conversations(@RequestParam(required = false) Integer limit) {
        return Result.ok(chatService.conversations(CurrentUserContext.currentUserId(), limit));
    }

    /**
     * 创建群聊：建群 + 创建者入群为群主 + 受邀成员入群。
     *
     * <p><b>为什么需要这个端点：</b>在此之前系统只有「按 groupId 往群里发消息」的能力，
     * 却没有任何创建群组的入口——聊天弹窗的「群聊」分支只能让用户手填一个群组 ID，
     * 而 {@code sys_group} 里既没有种子数据、也没有别的写入路径，该分支对任何用户都是死路。
     * 本端点补上这一环，群聊才真正可用。</p>
     *
     * <p><b>挂 {@code chat:group:create} 权限点</b>（见 {@code sql/V14}）：建群会写入
     * {@code sys_group} / {@code sys_group_member} 两张表并决定后续消息的可见范围，
     * 是本域唯一的写操作，也是唯一需要门禁的操作。读操作（会话列表 / 历史 /
     * 「我加入的群」）沿用「登录即用」口径，避免把聊天本身锁死。</p>
     *
     * <p><b>前端拿返回值的 {@code id} 直接进会话</b>（{@code scope=2 + targetId=id}），
     * 不需要再查一次列表——否则「建群成功」与「能开始聊」之间会多一段空窗期，
     * 用户在此期间只能看到一个空会话框。</p>
     *
     * @param dto 群名 + 受邀成员 ID 列表（不含创建者，服务端自动补群主）
     */
    @PostMapping("/groups")
    @RequiresPerm("chat:group:create")
    public Result<ChatGroupVO> createGroup(@Valid @RequestBody ChatGroupCreateDTO dto) {
        return Result.ok(chatGroupService.create(CurrentUserContext.currentUserId(), dto));
    }

    /**
     * 我加入的群（聊天弹窗的会话目标选择器 / 建群后回显）。
     *
     * <p><b>为什么必须有这个端点：</b>群聊会话以 {@code targetId = 群组 ID} 定位，
     * 而普通用户无从知道自己加入了哪些群——群组管理面（若存在）属管理权限，
     * 用户也不该为了发条群消息去管理面查 ID。没有它，用户就只能靠记忆手填雪花 ID，
     * 这与单聊「必须先有 {@code /targets/resolve}」是同一类缺陷。</p>
     *
     * <p><b>不挂权限点、登录即用</b>：与 {@code /conversations} 同理——查询维度写死为
     * 登录人本人，只返回其 {@code sys_group_member} 里的群，不存在「列出他人群组」的入参面。
     * 若给它加权限点，默认角色拿不到就表现为「建完群却看不到群」，
     * 把可用性事故伪装成权限配置问题。</p>
     */
    @GetMapping("/groups")
    public Result<List<ChatGroupVO>> myGroups() {
        return Result.ok(chatGroupService.listMine(CurrentUserContext.currentUserId()));
    }

    /**
     * 群详情（群配置面板的数据源）。
     *
     * <p><b>不挂权限点、登录即用，但必须是群成员</b>：查询维度写死为「我与该群的关系」，
     * 非成员一律 1012（{@code ChatGroupService#requireMember}），
     * 故不存在「用群 ID 遍历他人群资料」的入参面。挂权限点会让「建完群却打不开群设置」
     * 变成一次权限配置事故。</p>
     *
     * <p><b>返回里带 {@code ability}</b>：前端登录态没有可信用户主键，无法自行判断
     * 「我是不是这个群的群主」，按钮显隐必须由服务端算好（见 {@code ChatGroupAbilityVO}）。</p>
     *
     * @param groupId 群 ID
     */
    @GetMapping("/groups/{groupId}")
    public Result<ChatGroupDetailVO> groupDetail(@PathVariable Long groupId) {
        return Result.ok(chatGroupService.detail(CurrentUserContext.currentUserId(), groupId));
    }

    /**
     * 修改群名（群主 / 管理员）。
     *
     * <p><b>挂 {@code chat:group:update}</b>：这是对群公共属性的写操作，改错会影响到
     * 群里每个人看到的会话标题。权限点回答「这个账号能不能改群资料」，
     * 「这个群归不归他管」由服务层的群内身份判定回答（不足分别 1003 / 1038）。</p>
     *
     * @param groupId 群 ID
     * @param dto     新群名
     */
    @PatchMapping("/groups/{groupId}")
    @RequiresPerm("chat:group:update")
    public Result<ChatGroupDetailVO> renameGroup(@PathVariable Long groupId,
                                                 @Valid @RequestBody ChatGroupUpdateDTO dto) {
        return Result.ok(chatGroupService.rename(
                CurrentUserContext.currentUserId(), groupId, dto));
    }

    /**
     * 邀请成员入群（群主 / 管理员）。
     *
     * <p><b>幂等：</b>已在群里的 ID 按成功跳过，不是错误——批量邀请里有一人已在群
     * 就让整批回滚，会逼调用方逐个重试。被移除过又重新邀请的 ID 走「复活」路径，
     * 对外同样是成功（见 {@code ChatGroupMemberAddDTO}）。</p>
     *
     * @param groupId 群 ID
     * @param dto     受邀成员 ID 列表
     */
    @PostMapping("/groups/{groupId}/members")
    @RequiresPerm("chat:group:invite")
    public Result<ChatGroupDetailVO> inviteGroupMembers(@PathVariable Long groupId,
                                                        @Valid @RequestBody ChatGroupMemberAddDTO dto) {
        return Result.ok(chatGroupService.invite(
                CurrentUserContext.currentUserId(), groupId, dto));
    }

    /**
     * 移除群成员（仅群主）。
     *
     * <p><b>为什么把被移除者放进路径而不是请求体：</b>这是「对某个具体成员的一次删除」，
     * 路径 {@code /members/{userId}} 与被删资源一一对应，天然可缓存语义清晰；
     * 且与「邀请」用请求体传一批人区分开来——移除永远是一次一个人的决定。</p>
     *
     * <p>被移除者立刻失去该群全部读写权限（发送 / 历史都只认成员行），
     * 且群主不可被移除（含群主想「移除自己」的退群错觉，返回 1039）。</p>
     *
     * @param groupId 群 ID
     * @param userId  被移除的成员用户 ID
     */
    @DeleteMapping("/groups/{groupId}/members/{userId}")
    @RequiresPerm("chat:group:remove")
    public Result<ChatGroupDetailVO> removeGroupMember(@PathVariable Long groupId,
                                                       @PathVariable Long userId) {
        return Result.ok(chatGroupService.removeMember(
                CurrentUserContext.currentUserId(), groupId, userId));
    }

    /**
     * 退出群聊（非群主成员）。
     *
     * <p><b>不挂权限点、登录即用</b>：作用对象写死为登录人自己（路径里没有他人的 ID），
     * 越权面为零。加权限点会造出「进了群却退不出去」的角色——只能求管理员删数据。</p>
     *
     * <p>群主调用返回 1039（群主退群会造出无主群，须先解散）。
     * 退出后该会话在客户端的再次打开会得到 1012，前端据此提示并收起会话。</p>
     *
     * @param groupId 群 ID
     */
    @PostMapping("/groups/{groupId}/quit")
    public Result<Void> quitGroup(@PathVariable Long groupId) {
        chatGroupService.quit(CurrentUserContext.currentUserId(), groupId);
        return Result.ok();
    }

    /**
     * 解散群聊（仅群主），不可逆。
     *
     * <p><b>为什么解散要连带清空全体成员关系：</b>发送与历史拉取都只认成员行，
     * 只停群行起不到终止效果（见 {@code ChatGroupService#dissolve}）。
     * 解散后群不再出现在「我加入的群」里，历史会话项点击将得到 1012。</p>
     *
     * <p>路径与「改群名」同为 {@code /groups/{groupId}}，靠 HTTP 方法区分：
     * {@code DELETE} 是这个资源被移除（解散），{@code PATCH} 是它被修改。</p>
     *
     * @param groupId 群 ID
     */
    @DeleteMapping("/groups/{groupId}")
    @RequiresPerm("chat:group:dissolve")
    public Result<Void> dissolveGroup(@PathVariable Long groupId) {
        chatGroupService.dissolve(CurrentUserContext.currentUserId(), groupId);
        return Result.ok();
    }

    /**
     * 订阅会话对端的在线状态，并返回其当前值（单聊）。
     *
     * <p><b>为什么「订阅」要客户端显式声明：</b>状态变更的推送目标是「正在看这个人的人」，
     * 而这份关系只存在于客户端界面里——服务端既不知道谁打开了哪个会话，也不该为此去查一遍
     * 消息表（见 {@code RedisKeyConstants#WS_PRESENCE_WATCH_PREFIX}）。打开会话即订阅、
     * 关闭即停止续订，由客户端把「谁在看」这个事实交给服务端。</p>
     *
     * <p><b>一次往返同时完成「读当前值」与「登记订阅」：</b>客户端打开会话时必须先拿到当前状态才
     * 能画点，此后每 30s 续订一次（续订窗口 2min）。若拆成两个端点，客户端每次都要发两个请求，
     * 而「要不要显示状态点」与「要不要订阅」永远是同一个决定，没有拆开的理由。</p>
     *
     * <p><b>不产生持久事实</b>（Redis 里只有状态记录与订阅名单，且都会自动过期），
     * 因此定级为登录即用、不挂权限点；限流额度按「单个会话每 30s 一次」的量级放宽，
     * 多标签页并开也不会误伤。</p>
     *
     * @param scope    会话范围：仅 1-单聊（群聊无单一对端，返回 2001）
     * @param targetId 对端用户 ID
     */
    @PostMapping("/presence/watch")
    @RateLimit(windowSeconds = 60, max = 240, key = "chat-presence-watch",
            message = "在线状态订阅过于频繁，请稍后再试")
    public Result<ChatPresenceVO> watchPresence(@RequestParam Integer scope,
                                                @RequestParam Long targetId) {
        return Result.ok(chatService.watchPresence(
                CurrentUserContext.currentUserId(), scope, targetId));
    }

    /**
     * 转发「我正在输入」瞬时信号给对端（单聊，对端通过 {@code TYPING} 帧收到）。
     *
     * <p><b>上行走 HTTP 的理由与发送消息一致</b>（见类注）：需要限流、需要明确的参数错误、
     * 需要与消息投递同一把目标校验尺子，而这套东西 HTTP 上已经齐备；下行仍是 WebSocket 帧。
     * 客户端按键节流后约每 3s 一次、停止输入时补一次 {@code typing=false}，
     * 因此限流额度按每分钟 120 次给出足够余量（含多标签页）。</p>
     *
     * <p>无响应体：本信号不产生任何可回读的事实，客户端也不需要它的结果（下一个续订帧会自愈）。</p>
     *
     * @param scope    会话范围：仅 1-单聊（群聊返回 2001）
     * @param targetId 对端用户 ID（消息接收人视角）
     * @param typing   {@code true} 开始 / 继续输入；{@code false} 停止输入
     */
    @PostMapping("/typing")
    @RateLimit(windowSeconds = 60, max = 120, key = "chat-typing",
            message = "输入状态发送过于频繁，请稍后再试")
    public Result<Void> typing(@RequestParam Integer scope,
                               @RequestParam Long targetId,
                               @RequestParam boolean typing) {
        chatService.notifyTyping(CurrentUserContext.currentUserId(), scope, targetId, typing);
        return Result.ok();
    }
}
