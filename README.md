# 한글 친구들 (40개월 아이용 한글 놀이 웹앱)

아이패드 Safari에서 열어 "홈 화면에 추가"하면 앱처럼 쓰는 PWA입니다. 빌드 과정이 없는 정적 파일입니다.

## GitHub Pages 배포
1. GitHub에서 새 저장소 만들기 (예: `hangul-friends`, Public)
2. 이 폴더의 파일 전체를 저장소 루트에 올리기 (GitHub Desktop 또는 웹의 "Upload files")
3. 저장소 Settings → Pages → Branch: `main` / `/ (root)` → Save
4. 1~2분 뒤 `https://<아이디>.github.io/hangul-friends/` 접속
5. 아이패드 Safari에서 열고 공유 버튼 → "홈 화면에 추가"

## 파일을 고친 뒤
`sw.js`의 `VERSION` 값을 올려야 아이패드 캐시가 갱신됩니다.

## 구성
- 따라쓰기(자음 14·모음 10) + 캐릭터 스티커 / 풍선 터뜨리기 / 글자 블록 / 그리기 / 스티커북·꾸미기 / 내 이름 쓰기
- 부모 모드(홈의 ⚙️, 덧셈 확인): 사용시간 제한, 난이도, 이름, 진행도, 내 목소리 녹음, 초기화
