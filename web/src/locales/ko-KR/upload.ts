/** 청크 업로드 페이지와 업로드 팝업 문구. */
export default {
  'upload.title': '파일 업로드',
  'upload.titleWithFolder': '파일 업로드(디렉터리 #{folderId})',
  'upload.dropText': '클릭하거나 파일을 여기로 끌어오세요',
  'upload.dropHint':
    '여러 개 선택 가능. 대용량 파일은 자동으로 청크(기본 4 MiB)로 나누고 요약을 계산하며, 즉시 전송에 해당하면 전송하지 않습니다',
  'upload.instant': '즉시 전송',
  'upload.verifying': '검증 중',
  'upload.chunkProgress': ' · {received}/{total} 청크',
  'upload.chunkTooltip': '청크 {index}',
  'upload.retried': '{count}회 자동 재시도함',
  'upload.empty': '업로드 작업이 없습니다',
  'upload.summary': '진행 중 {uploading} · 완료 {finished} · 총 {total}',

  // 작업 상태
  'upload.status.pending': '대기 중',
  'upload.status.hashing': '요약 계산',
  'upload.status.prechecking': '즉시 전송 사전 검증',
  'upload.status.querying': '청크 조회',
  'upload.status.uploading': '업로드 중',
  'upload.status.paused': '일시 중지됨',
  'upload.status.merging': '병합 중',
  'upload.status.success': '완료됨',
  'upload.status.error': '실패',
  'upload.status.canceled': '취소됨',

  // 오류 문구(서비스 계층이 던지기 전에 현재 언어로 번역, services/upload 참고)
  'upload.error.generic': '업로드 실패',
  'upload.error.network':
    '네트워크 오류입니다. 네트워크를 확인한 뒤 다시 시도하세요',
  'upload.error.timeout': '업로드 시간 초과',
  'upload.error.badContract': '서버 응답 구조가 통합 계약과 일치하지 않습니다',
  'upload.error.instantWithoutFileId':
    '즉시 전송에 해당했지만 fileId가 반환되지 않았습니다',
  'upload.error.missWithoutUploadId':
    '즉시 전송에 해당하지 않는데 uploadId가 반환되지 않았습니다',
  'upload.error.partHttp': '청크 업로드 실패(HTTP {status})',
  'upload.error.hashWorkerFailed': '해시 Worker 실행 실패',
  'upload.error.hashFailed': '해시 계산 실패',

  // 동작
  'upload.action.pause': '일시 중지',
  'upload.action.resume': '계속',
  'upload.action.remove': '제거',
  'upload.action.pauseAll': '모두 일시 중지',
  'upload.action.resumeAll': '모두 계속',
  'upload.action.clearFinished': '종료된 항목 지우기',

  // 이어올리기
  'upload.resumable.title': '지난번 완료되지 않은 업로드를 찾았습니다',
  'upload.resumable.note':
    '아래 진행률은 로컬 캐시에서 온 참고 값입니다. 실제 이어올리기 위치는 서버의 청크 목록을 기준으로 합니다.',
  'upload.resumable.record': '{name}({size}, 완료 {received}/{total} 청크)',
  'upload.resumable.ignore': '무시',
  'upload.resumable.select': '파일 선택하여 이어올리기',
  'upload.resumable.hint':
    '지난번과 같은 이름의 동일한 파일을 선택해야 합니다(이름은 같지만 내용이 바뀌면 인식하여 다시 업로드합니다)',

  // 완료 목록
  'upload.column.method': '방식',
  'upload.column.chunked': '청크 업로드',

  // 업로드 방식(청크 요청 본문 형태) — 데모 페이지 카드와 업로드 컴포넌트가 같은 명칭을 공유
  'upload.mode.title': '업로드 방식',
  'upload.mode.subtitle':
    '두 가지 청크 요청 본문 형태, 파라미터는 각각 독립적으로 저장됩니다',
  'upload.mode.active': '현재 사용',
  'upload.mode.use': '이 방식 사용',
  'upload.mode.fact.request': '요청 본문',
  'upload.mode.fact.scene': '적용 시나리오',
  'upload.mode.unsupportedTag': '백엔드 미지원',
  'upload.mode.switchHint':
    '전환은 이후에 추가된 작업에만 영향을 줍니다. 진행 중인 작업은 시작할 때의 방식을 계속 사용하므로 한 번의 업로드에서 두 요청 본문이 섞이지 않습니다. 새 파라미터도 다음 작업부터 적용됩니다.',
  'upload.mode.multipart.title': '폼 청크',
  'upload.mode.multipart.tag': 'multipart/form-data',
  'upload.mode.multipart.desc':
    '각 청크를 `FormData`로 감싸 보내고 청크 번호와 요약을 폼 필드로 함께 제출합니다. 호환성이 가장 좋고 현재 백엔드의 기본 기준이기도 합니다.',
  'upload.mode.multipart.request':
    '`PUT` 청크 API, 요청 본문은 `FormData`(`chunk` + `index` + `hash`)',
  'upload.mode.multipart.scene':
    '백엔드가 Spring `@RequestPart` / `MultipartFile`로 청크를 받는 경우(계약 기본 기준)',
  'upload.mode.octetStream.title': '바이너리 스트림',
  'upload.mode.octetStream.tag': 'application/octet-stream',
  'upload.mode.octetStream.desc':
    '청크를 순수 바이트 스트림으로 요청 본문에 그대로 넣고 청크 번호는 URL로 정합니다. 폼 래핑 한 겹과 메모리 복사 한 번을 줄입니다.',
  'upload.mode.octetStream.request':
    '`PUT` 청크 API, 요청 본문은 순수 바이트 스트림(`Content-Type: application/octet-stream`, `hash` 필드 없음)',
  'upload.mode.octetStream.scene':
    '오브젝트 스토리지 직접 업로드, 또는 게이트웨이가 순수 스트림으로 전달하고 폼 파싱을 하지 않는 경우',
  'upload.mode.octetStream.unsupported':
    '현재 at-transfer 청크 API는 `multipart/form-data`만 선언하고 있어, 이를 선택하면 청크 보고 시 HTTP 415가 발생합니다. 백엔드가 순수 스트림 수신을 먼저 지원해야 합니다(프런트엔드는 준비됨).',

  // 데모 페이지(/upload). 문구의 백틱은 페이지에서 인라인 코드 스타일로 렌더링됩니다.
  'upload.demo.pageTitle': '청크 업로드',
  'upload.demo.pageSubtitle': '즉시 전송 · 이어올리기 · 동시 청크',
  'upload.demo.pipeline.title': '업로드 흐름',
  'upload.demo.pipeline.subtitle': '요약 → 즉시 전송 → 보충 전송 → 병합',
  'upload.demo.pipeline.desc':
    '대용량 파일은 먼저 로컬에서 요약을 계산하고 서버가 이를 기준으로 즉시 전송 가능 여부를 판단합니다. 해당하지 않으면 빠진 청크만 보충 전송하며, 언제든 페이지를 새로 고친 뒤 같은 파일을 다시 선택하면 서버가 받은 위치부터 이어서 업로드합니다.',
  'upload.demo.step.hash.title': '검증 값 계산',
  'upload.demo.step.hash.desc':
    'Worker 내부에서 증분 SHA-256, 메인 스레드가 멈추지 않습니다',
  'upload.demo.step.precheck.title': '즉시 전송 사전 검증',
  'upload.demo.step.precheck.desc': '요약이 일치하면 완료, 0바이트 전송',
  'upload.demo.step.query.title': '받은 청크 조회',
  'upload.demo.step.query.desc': '서버 목록을 기준으로 합니다',
  'upload.demo.step.upload.title': '동시 보충 전송',
  'upload.demo.step.upload.desc': '기본 3 동시, 실패 시 백오프 재시도',
  'upload.demo.step.merge.title': '병합 검증',
  'upload.demo.step.merge.desc':
    '서버가 전체 파일의 요약을 다시 계산한 뒤 병합합니다',
  'upload.demo.chunkTitle': '청크 업로드 데모',
  'upload.demo.finished.title': '완료된 파일',
  'upload.demo.finished.subtitle': '최근 {count}건까지 보관',
  'upload.demo.usage.title': '연동 방식',
  'upload.demo.usage.subtitle':
    '컴포넌트와 Hook 두 가지 사용법, 같은 큐를 공유',
  'upload.demo.usage.desc':
    '컴포넌트는 큐와 진행률 표시를 내장하고 있어 페이지에 넣기만 하면 됩니다. 업무 페이지에서 레이아웃을 직접 구성하려면 Hook `useChunkUpload()`로 상태와 동작을 받아 화면을 직접 그리세요. 둘 다 `id`만 보므로 `id`가 같으면 같은 큐이며 한 페이지에서 함께 써도 됩니다.',
  'upload.demo.usage.tab.component': '컴포넌트 사용법',
  'upload.demo.usage.tab.hook': 'Hook 사용법',
  'upload.demo.usage.component.point1':
    '`id`가 큐의 정체성을 결정합니다. 같은 id의 여러 컴포넌트가 하나의 큐를 공유하므로 페이지를 옮기거나 다시 마운트해도 전송이 끊기지 않습니다.',
  'upload.demo.usage.component.point2':
    '`chunkSize`와 `concurrency`는 큐에 넣을 때 계약 범위(≤ 8 MiB, 1~5 동시)로 수렴하므로, 범위를 넘는 값을 넘겨도 잘못된 청크가 나가지 않습니다.',
  'upload.demo.usage.component.point3':
    '`partPayloadMode`는 작업 단위로 적용됩니다. 업로드 중에 바꾸면 이후 추가된 작업에만 영향을 줍니다.',
  'upload.demo.usage.hook.point1':
    '`tasks`와 `resumable`은 구독한 스냅샷입니다. 진행률 갱신이 폴링에 의존하지 않고, 고빈도 진행률을 state에 쓰지도 않습니다.',
  'upload.demo.usage.hook.point2':
    '`start()`는 파일을 넣는 즉시 시작하고 이번 작업들의 id를 반환합니다. 일시 중지 / 이어올리기 / 재시도 / 취소에 각각 대응하는 동작이 있습니다.',
  'upload.demo.usage.hook.point3':
    'Hook은 상태와 동작만 주고 화면은 그리지 않습니다. 목록, 진행률 표시줄, 버튼은 모두 업무 페이지가 결정합니다.',
  'upload.demo.tryRun.title': '시험 실행 방법',
  'upload.demo.tryRun.localMock':
    '이 페이지에는 로컬 mock(`src/pages/upload/_mock.ts`, umi는 페이지 디렉터리의 `_mock.ts`만 로드)이 포함되어 있어, `npm run start`로 실행하면(mock 자동 켜짐) 업로드 흐름을 오프라인에서도 확인할 수 있고 같은 파일을 한 번 더 올리면 즉시 전송에 해당합니다.',
  'upload.demo.tryRun.dev':
    '`npm run dev`로 실행하면 mock이 꺼지고 `/api`가 `localhost:8080`으로 프록시되므로, 이때는 백엔드 at-transfer API가 준비되어 있어야 합니다.',
  'upload.demo.tryRun.auth':
    '참고: 다른 업무 페이지와 마찬가지로 이 페이지도 로그인 가드로 보호됩니다(미로그인 시 `/user/login`으로 이동). 로그인 API에는 아직 mock이 없어 백엔드 at-auth가 필요하므로 mock은 “업로드 흐름” 구간만 커버합니다.',
} as const;
