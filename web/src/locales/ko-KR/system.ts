/** 시스템 관리(사용자 / 역할 / 부서 / 그룹 / 메뉴 권한) 문구。 */
export default {
  // 여러 페이지에서 재사용하는 시스템 영역 동작 / 열 이름
  'system.action.edit': '편집',
  'system.action.delete': '삭제',
  'system.action.create': '생성',
  'system.column.action': '작업',
  'system.column.status': '상태',
  'system.column.remark': '비고',
  'system.column.createTime': '생성 시간',
  'system.alert.boundaryTitle': '작업 경계',

  // 사용자 상태
  'system.userStatus.normal': '정상',
  'system.userStatus.disabled': '사용 중지',
  'system.userStatus.locked': '잠김',
  'system.userStatus.unknown': '알 수 없음',

  // 데이터 범위
  'system.dataScope.self': '본인만',
  'system.dataScope.deptAndSub': '본 부서 및 하위',
  'system.dataScope.all': '전체',
  'system.dataScope.unknown': '알 수 없음({scope})',

  // 권한 포인트 차원
  'system.permType.menu': '메뉴',
  'system.permType.action': '작업',
  'system.permType.dataScope': '데이터 범위',
  'system.permType.unknown': '알 수 없음({type})',

  // 사용자 관리 페이지
  'system.user.title': '사용자 관리',
  'system.user.subtitle': '계정, 부서, 상태 및 역할 소속',
  'system.user.alertBoundary':
    '보호된 계정은 비활성화 / 삭제 / 역할 변경이 불가합니다. 관리자는 자기 자신에 대해 비활성화, 비밀번호 재설정, 역할 할당, 삭제를 할 수 없습니다(서버가 거부하며 자기 권한 상승 방지가 포함됩니다). 데이터 범위가 제한되면 목록과 역할 드롭다운이 자동으로 좁혀집니다.',
  'system.user.column.keyword': '계정 / 닉네임',
  'system.user.column.keywordPlaceholder': '계정 또는 닉네임, 부분 일치',
  'system.user.column.username': '계정',
  'system.user.column.nickname': '닉네임',
  'system.user.column.dept': '부서',
  'system.user.column.deptPlaceholder': '표시 가능한 모든 부서',
  'system.user.column.roles': '역할',
  'system.user.column.lastLogin': '최근 로그인',
  'system.user.protectedTag': '보호됨',
  'system.user.action.assignRole': '역할 할당',
  'system.user.action.resetPassword': '비밀번호 재설정',
  'system.user.action.disable': '비활성화',
  'system.user.action.enable': '활성화',
  'system.user.action.locked': '잠김',
  'system.user.action.create': '사용자 생성',
  'system.user.confirm.disableTitle': '이 계정을 비활성화하시겠습니까?',
  'system.user.confirm.enableTitle': '이 계정을 활성화하시겠습니까?',
  'system.user.confirm.disableDesc':
    '비활성화하면 이 계정의 모든 진행 중 세션이 즉시 무효화됩니다.',
  'system.user.confirm.deleteTitle': '이 사용자를 삭제하시겠습니까?',
  'system.user.confirm.deleteDesc':
    '삭제 후에는 복구할 수 없습니다. 보호된 계정이거나 아직 참조되는 계정은 서버가 거부합니다.',
  'system.user.message.disabled': '{name}을(를) 비활성화했습니다',
  'system.user.message.enabled': '{name}을(를) 활성화했습니다',
  'system.user.message.deleted': '{name}을(를) 삭제했습니다',

  // 아바타(전용 경로: 업로드 즉시 적용, 편집 폼의 저장과 무관)
  'system.user.avatar.label': '아바타',
  'system.user.avatar.upload': '아바타 업로드',
  'system.user.avatar.hint': 'PNG / JPEG / GIF / WebP 지원, {max} 이하',
  'system.user.avatar.updated': '아바타가 업데이트되었습니다',
  'system.user.avatar.tooLarge': '이미지는 {max}를 초과할 수 없습니다',
  'system.user.avatar.typeInvalid':
    'PNG / JPEG / GIF / WebP 이미지만 지원합니다',

  // 사용자 생성 / 편집 대화상자
  'system.userForm.title.edit': '사용자 편집 · {name}',
  'system.userForm.title.create': '사용자 생성',
  'system.userForm.alert.title':
    '계정 이름, 상태, 역할, 비밀번호는 이 폼에 없습니다',
  'system.userForm.alert.desc':
    '계정 이름은 변경할 수 없습니다. 상태 / 비밀번호 / 역할은 목록의 해당 버튼을 사용하세요. 비고는 인터페이스가 반환하지 않아 편집을 제공하지 않습니다.',
  'system.userForm.field.username': '로그인 계정',
  'system.userForm.field.password': '초기 비밀번호',
  'system.userForm.field.nickname': '닉네임 / 이름',
  'system.userForm.field.dept': '소속 부서',
  'system.userForm.field.email': '이메일',
  'system.userForm.field.mobile': '휴대전화',
  'system.userForm.field.roleIds': '초기 역할',
  'system.userForm.placeholder.username': '3~64자 영문/숫자/밑줄/점/하이픈',
  'system.userForm.placeholder.password': '8~64자',
  'system.userForm.placeholder.dept': '미지정',
  'system.userForm.placeholder.roleIds': '역할 미할당',
  'system.userForm.extra.deptEdit':
    '부서를 변경하면 전보로 간주되어 해당 사용자의 “승인으로 획득한” 모든 유효 권한이 회수됩니다',
  'system.userForm.extra.deptCreate': '비워 두면 부서 미지정',
  'system.userForm.extra.emailEdit':
    '비워 두면 변경하지 않음(백엔드 보수 정책, 이메일은 비울 수 없음)',
  'system.userForm.extra.mobileEdit': '비워 두면 변경하지 않음',
  'system.userForm.extra.roleIds':
    '할당하지 않아도 됩니다. 데이터 범위가 “전체”가 아니면 자신이 보유한 역할만 할당할 수 있습니다({perm} 필요).',
  'system.userForm.rule.usernameRequired': '로그인 계정을 입력하세요',
  'system.userForm.rule.usernamePattern':
    '3~64자 영문/숫자/밑줄/점/하이픈이어야 합니다',
  'system.userForm.rule.passwordRequired': '초기 비밀번호를 입력하세요',
  'system.userForm.rule.passwordLength': '비밀번호 길이는 8~64자여야 합니다',
  'system.userForm.rule.nicknameRequired': '닉네임을 입력하세요',
  'system.userForm.rule.nicknameMax': '64자를 초과할 수 없습니다',
  'system.userForm.rule.emailInvalid': '이메일 형식이 올바르지 않습니다',
  'system.userForm.rule.emailMax': '128자를 초과할 수 없습니다',
  'system.userForm.rule.mobileMax': '32자를 초과할 수 없습니다',
  'system.userForm.rule.remarkMax': '255자를 초과할 수 없습니다',
  'system.userForm.message.updated': '사용자 정보가 업데이트되었습니다',
  'system.userForm.message.created': '사용자가 생성되었습니다',
  'system.userForm.roleOption': '{name}({code}·{scope})',

  // 비밀번호 재설정 대화상자
  'system.resetPassword.title': '비밀번호 재설정 · {name}',
  'system.resetPassword.ok': '재설정 확인',
  'system.resetPassword.alert.title':
    '재설정 후 이 사용자의 모든 진행 중 세션이 즉시 무효화됩니다',
  'system.resetPassword.alert.desc':
    '사용자는 새 비밀번호로 다시 로그인해야 합니다. 관리자는 기존 비밀번호를 볼 수 없습니다(저장소에는 해시만 보관).',
  'system.resetPassword.field.newPassword': '새 비밀번호',
  'system.resetPassword.field.confirmPassword': '새 비밀번호 확인',
  'system.resetPassword.placeholder.password': '8~64자',
  'system.resetPassword.rule.newRequired': '새 비밀번호를 입력하세요',
  'system.resetPassword.rule.length': '비밀번호 길이는 8~64자여야 합니다',
  'system.resetPassword.rule.confirmRequired': '새 비밀번호를 다시 입력하세요',
  'system.resetPassword.rule.mismatch':
    '두 번 입력한 비밀번호가 일치하지 않습니다',
  'system.resetPassword.message.done':
    '비밀번호가 재설정되었고 이 사용자의 모든 진행 중 세션이 무효화되었습니다',

  // 역할 할당 드로어
  'system.assignRole.title': '역할 할당 · {name}',
  'system.assignRole.alert.protected.title': '보호된 계정',
  'system.assignRole.alert.protected.desc':
    '슈퍼 관리자 역할은 반드시 유지해야 하며, 제거하면 서버가 거부합니다.',
  'system.assignRole.alert.mode.title': '전체 교체 + 최소 하나의 역할 유지',
  'system.assignRole.alert.mode.desc':
    '제출하면 이번에 선택한 항목이 기준이 됩니다(증분 아님). 백엔드는 역할 집합이 비어 있지 않아야 하므로 최소 하나를 선택하세요.',
  'system.assignRole.searchPlaceholder': '역할 이름 / 코드로 필터',
  'system.assignRole.empty.noOptions':
    '할당 가능한 역할이 없습니다(데이터 범위 제한일 수 있음)',
  'system.assignRole.empty.noMatch': '일치하는 역할이 없습니다',
  'system.assignRole.atLeastOne':
    '역할을 최소 하나 선택하세요: 백엔드에서 역할 집합에 대해 비어 있지 않음을 검증합니다.',
  'system.assignRole.message.done': '역할이 업데이트되었습니다',

  // 역할 관리 페이지
  'system.role.title': '역할 관리',
  'system.role.subtitle': '역할 본체와 권한 매트릭스',
  'system.role.alertBoundary':
    '내장 역할은 삭제할 수 없고 데이터 범위를 변경할 수 없습니다. 시스템 관리 영역의 권한 포인트는 슈퍼 관리자에게만 부여됩니다. 데이터 범위가 “전체”가 아니면 새 역할에는 자신보다 높지 않은 데이터 범위만 부여할 수 있고, 권한 할당도 자신이 보유한 권한 포인트만 선택할 수 있습니다(서버가 권한 상승을 차단).',
  'system.role.column.keyword': '역할 이름 / 코드',
  'system.role.column.keywordPlaceholder': '이름 또는 코드, 부분 일치',
  'system.role.column.name': '역할 이름',
  'system.role.column.code': '코드',
  'system.role.column.dataScope': '데이터 범위',
  'system.role.column.permissionSet': '권한 집합',
  'system.role.builtInTag': '내장',
  'system.role.lockedTag': '잠금 읽기 전용',
  'system.role.maintainableTag': '유지보수 가능',
  'system.role.action.assignPerm': '권한 할당',
  'system.role.action.create': '역할 생성',
  'system.role.confirm.deleteTitle': '이 역할을 삭제하시겠습니까?',
  'system.role.confirm.deleteDesc':
    '내장 역할이거나 연결된 권한이 있거나 아직 사용자가 보유한 역할은 서버가 거부합니다.',
  'system.role.message.deleted': '역할 {name}을(를) 삭제했습니다',

  // 역할 생성 / 편집 대화상자
  'system.roleForm.title.edit': '역할 편집 · {name}',
  'system.roleForm.title.create': '역할 생성',
  'system.roleForm.alert.title': '내장 역할',
  'system.roleForm.alert.desc':
    '코드와 데이터 범위는 수정할 수 없고 이름과 비고만 조정할 수 있습니다. 권한 매트릭스는 “권한 할당” 드로어에서 관리합니다.',
  'system.roleForm.field.code': '역할 코드',
  'system.roleForm.field.name': '역할 이름',
  'system.roleForm.field.dataScope': '데이터 범위',
  'system.roleForm.placeholder.code': '예: DEPT_ADMIN',
  'system.roleForm.extra.codeEdit':
    '코드는 역할의 외부 식별자이며 생성 후 수정할 수 없습니다',
  'system.roleForm.extra.dataScopeBuiltIn':
    '내장 역할의 데이터 범위는 수정할 수 없습니다',
  'system.roleForm.extra.dataScopeMax':
    '자신의 데이터 범위를 초과할 수 없습니다(현재: {scope})',
  'system.roleForm.rule.codeRequired': '역할 코드를 입력하세요',
  'system.roleForm.rule.codePattern':
    '대문자로 시작하고 대문자/숫자/밑줄만 포함해야 합니다',
  'system.roleForm.rule.nameRequired': '역할 이름을 입력하세요',
  'system.roleForm.rule.nameMax': '64자를 초과할 수 없습니다',
  'system.roleForm.rule.dataScopeRequired': '데이터 범위를 선택하세요',
  'system.roleForm.message.updated': '역할이 업데이트되었습니다',
  'system.roleForm.message.created': '역할이 생성되었습니다',

  // 역할 권한 부여 드로어
  'system.rolePerm.title': '권한 할당 · {name}',
  'system.rolePerm.alert.locked.title':
    '감사자 역할의 권한 집합이 잠겨 있습니다',
  'system.rolePerm.alert.locked.desc':
    '서비스 계층이 이 역할의 권한 집합에 대한 모든 변경을 거부합니다(1021). 이 드로어는 읽기 전용입니다.',
  'system.rolePerm.alert.readOnly.title': '읽기 전용',
  'system.rolePerm.alert.readOnly.desc':
    '역할 부여 권한 포인트(system:role:assign-perm)가 없어 현재 권한 매트릭스만 볼 수 있습니다.',
  'system.rolePerm.alert.selfLock.title':
    '자기 잠금 방지: 세 개의 권한 포인트는 제거할 수 없습니다',
  'system.rolePerm.alert.selfLock.desc':
    '{codes}를 반드시 유지해야 합니다. 그렇지 않으면 아무도 권한을 관리할 수 없게 되어 서버가 바로 거부합니다.',
  'system.rolePerm.alert.narrow.title':
    '권한 상승 방지: 자신이 보유한 권한 포인트만 부여할 수 있습니다',
  'system.rolePerm.alert.narrow.desc':
    '데이터 범위가 “전체”가 아니면 “부여 불가”로 표시된 노드는 제출 시 서버가 거부합니다.',
  'system.rolePerm.tooltip.required':
    '자기 잠금 방지: 슈퍼 관리자는 이 “관리 능력의 입구”를 반드시 유지해야 하며, 서버가 제거를 거부합니다',
  'system.rolePerm.tooltip.notHeld':
    '데이터 범위가 “전체”가 아니면 자신이 보유하지 않은 권한 포인트를 부여할 수 없습니다(서버가 권한 상승 차단)',
  'system.rolePerm.tag.required': '필수 유지',
  'system.rolePerm.tag.notHeld': '부여 불가',
  'system.rolePerm.selected': '{selected}개 선택 / 총 {total}개 권한 포인트',
  'system.rolePerm.parentNote': '(상위 노드 포함 = 입구 표시)',
  'system.rolePerm.empty': '권한 포인트 목록이 비어 있습니다',
  'system.rolePerm.message.mustKeep':
    '슈퍼 관리자 역할은 다음 권한 포인트를 반드시 유지해야 합니다: {codes}',
  'system.rolePerm.message.done': '역할 권한이 업데이트되었습니다',

  // 메뉴 / 권한 포인트 목록(읽기 전용)
  'system.menu.title': '메뉴 / 권한 포인트 목록',
  'system.menu.subtitle': '권한 모델 현황(읽기 전용)',
  'system.menu.alert.title':
    '읽기 전용 페이지: 권한 포인트의 추가/삭제/수정은 SQL 마이그레이션 스크립트로 관리합니다',
  'system.menu.alert.desc':
    '이 프로젝트는 “메뉴”와 “작업”을 권한 포인트로 통합 모델링합니다(type: 1-메뉴 2-작업 3-데이터 범위). 현재는 목록 조회 엔드포인트(GET /api/v1/permission-points)만 있고 권한 포인트 유지보수 인터페이스는 없습니다. 특정 역할에 권한을 선택하려면 “역할 관리 → 권한 할당”으로 이동하세요.',
  'system.menu.column.permName': '권한 포인트 이름',
  'system.menu.column.permCode': '권한 코드',
  'system.menu.column.type': '차원',
  'system.menu.column.sortNo': '정렬',
  'system.menu.stat.total': '전체 권한 포인트',
  'system.menu.stat.menu': '메뉴 노드',
  'system.menu.stat.action': '작업 노드',
  'system.menu.stat.scope': '데이터 범위 노드',
  'system.menu.headerTitle': '권한 포인트 트리',
  'system.menu.searchPlaceholder': '이름 / 코드로 필터',
  'system.menu.empty.noPerm':
    '권한 부족: system:role:list 또는 system:role:assign-perm 필요',

  // 그룹 관리(자리 표시 설명)
  'system.group.title': '그룹 관리',
  'system.group.subtitle': '아직 제공되지 않음',
  'system.group.alert.title':
    'CE 버전은 그룹 관리 인터페이스를 제공하지 않아 이 페이지는 자리 표시 설명입니다',
  'system.group.alert.desc':
    '데이터 테이블 sys_group / sys_group_member는 이미 존재하지만 서버에 해당 관리 컨트롤러와 권한 포인트가 없습니다. “누르면 반드시 실패하는” 입구를 제공하지 않기 위해 여기서는 추가/삭제/수정 작업을 제공하지 않고 모의 데이터도 렌더링하지 않습니다.',
  'system.group.section.current.title': '현황',
  'system.group.section.current.subtitle':
    '데이터 테이블, 서버 엔티티 및 권한 포인트',
  'system.group.section.endpoints.title': '보완에 필요한 인터페이스',
  'system.group.section.endpoints.subtitle': '일정 목록',
  'system.group.desc.table': '데이터 테이블',
  'system.group.desc.entity': '서버 엔티티',
  'system.group.entity.note':
    '협업 도메인 내부에서만 사용(접근 판정), 외부 CRUD 없음',
  'system.group.desc.perm': '권한 포인트',
  'system.group.perm.none':
    'system:group:* 권한 포인트 없음(V9는 system:user:*와 system:role:*만 정의)',
  'system.group.desc.availability': '현재 가용성',
  'system.group.availability.readonly': '읽기 전용 사용 불가(인터페이스 없음)',
  'system.group.column.method': '메서드',
  'system.group.column.path': '경로',
  'system.group.column.purpose': '용도',
  'system.group.endpoint.groups.page': '그룹 페이지네이션 / 키워드 검색',
  'system.group.endpoint.groups.detail': '그룹 상세',
  'system.group.endpoint.groups.create': '그룹 생성',
  'system.group.endpoint.groups.update': '그룹 편집(이름 / 비고 / 담당자)',
  'system.group.endpoint.groups.remove': '그룹 삭제',
  'system.group.endpoint.members.list': '멤버 목록',
  'system.group.endpoint.members.replace': '멤버 전체 교체',

  // 부서 관리(읽기 전용)
  'system.dept.title': '부서 관리',
  'system.dept.subtitle': '조직 구조(읽기 전용)',
  'system.dept.alert.title':
    '읽기 전용 페이지: CE 버전은 부서 추가/삭제/수정 인터페이스를 제공하지 않습니다',
  'system.dept.alert.desc':
    '현재 사용 가능한 부서 엔드포인트는 GET /api/v1/system/users/dept-options뿐입니다(사용자 폼 드롭다운과 데이터 범위 판정용). 이 페이지는 조직 구조를 있는 그대로 보여주며 실행할 수 없는 쓰기 작업은 제공하지 않습니다. 부서 ID는 “사용자 전보”와 데이터 범위 계산에 함께 사용되므로 조정 전에 영향을 먼저 확인하세요.',
  'system.dept.column.name': '부서 이름',
  'system.dept.column.id': '부서 ID',
  'system.dept.column.parentId': '상위 부서 ID',
  'system.dept.column.depth': '계층',
  'system.dept.column.childCount': '하위 부서 수',
  'system.dept.depthValue': '{depth}계층',
  'system.dept.rootTag': '루트',
  'system.dept.stat.total': '전체 부서',
  'system.dept.stat.roots': '루트 부서',
  'system.dept.stat.maxDepth': '최대 계층',
  'system.dept.stat.rootsFooter': '상위 부서가 없는 최상위 노드',
  'system.dept.suffix.count': '개',
  'system.dept.suffix.level': '계층',
  'system.dept.headerTitle': '부서 목록',
  'system.dept.message.reloaded': '부서 목록을 다시 불러왔습니다',
} as const;
