// 🔑 공공데이터포털 키를 숨겨 주는 Netlify 함수
// 화면은 /api/tour?... 처럼 키 없이 주문하고, 이 함수가 Netlify 환경변수의 키를 붙여서 대신 주문해요.
// 키는 Netlify 사이트 설정 → Environment variables → DATA_GO_KR_KEY 에 넣어요. (코드·깃허브에는 없음)

// 🔌 이 함수가 대신 불러 줄 수 있는 API (여기 없는 주소는 막음)
const API = {
  tour: "https://apis.data.go.kr/B551011/KorService2/areaBasedList2",                  // 🔌 한국관광공사 TourAPI
  weather: "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",   // 🔌 기상청 단기예보
  air: "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth",   // 🔌 에어코리아 미세먼지 예보
  charger: "https://apis.data.go.kr/B552584/EvCharger/getChargerInfo",                 // 🔌 전기차 충전소
};

// 같은 주문은 잠깐 Netlify에 저장해 두고 다시 씀 (공공데이터포털 하루 호출 한도 아끼기)
const CACHE_SECONDS = { tour: 60 * 60 * 6, weather: 60 * 20, air: 60 * 30, charger: 60 * 3 };

// 충전소 응답은 수 MB라서, 화면에 필요한 급속·공용 충전기와 필요한 칸만 남겨 보냄
const FAST = ["01", "03", "04", "05", "06", "09", "10", "11"];
const CHARGER_FIELDS = ["statId", "statNm", "addr", "lat", "lng", "useTime", "parkingFree", "busiNm", "chgerType", "stat", "output", "limitYn"];

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8" },
});

export default async (req, context) => {
  const name = context.params.name;
  const target = API[name];
  if (!target) return json(404, { error: `없는 API예요: ${name}` });

  const key = Netlify.env.get("DATA_GO_KR_KEY");
  if (!key) return json(500, { error: "Netlify 환경변수 DATA_GO_KR_KEY가 비어 있어요." });

  const params = new URL(req.url).searchParams;
  params.delete("serviceKey"); // 화면이 키를 보내도 무시
  params.set("serviceKey", key);

  const res = await fetch(`${target}?${params}`); // 🔌 API 호출 (서버에서)
  let body = await res.text();

  if (name === "charger" && res.ok) {
    try {
      const data = JSON.parse(body);
      const items = (data.items?.item || [])
        .filter(c => FAST.includes(c.chgerType) && c.limitYn !== "Y")
        .map(c => Object.fromEntries(CHARGER_FIELDS.map(f => [f, c[f]])));
      body = JSON.stringify({ ...data, items: { item: items } });
    } catch { /* JSON이 아니면 받은 그대로 보냄 */ }
  }

  return new Response(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
      ...(res.ok ? { "netlify-cdn-cache-control": `public, s-maxage=${CACHE_SECONDS[name]}, durable` } : {}),
    },
  });
};

export const config = { path: "/api/:name" };
