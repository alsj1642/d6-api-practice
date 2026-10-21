// 🔑 공공데이터포털 키를 숨겨 주는 Netlify 함수 (하늘노트 배포판)
// 화면은 /api/rise?... 처럼 키 없이 주문하고, 이 함수가 Netlify 환경변수의 키를 붙여서 대신 주문해요.
// 키는 Netlify 사이트 설정 → Environment variables → DATA_GO_KR_KEY 에 넣어요. (코드·깃허브에는 없음)

// 🔌 이 함수가 대신 불러 줄 수 있는 API (여기 없는 주소는 막음) — 모두 한국천문연구원
const API = {
  rise: "https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getAreaRiseSetInfo",     // 🔌 출몰시각
  alt: "https://apis.data.go.kr/B090041/openapi/service/SrAltudeInfoService/getAreaSrAltudeInfo",     // 🔌 태양고도
  event: "https://apis.data.go.kr/B090041/openapi/service/AstroEventInfoService/getAstroEventInfo",   // 🔌 천문현상
};

// 같은 주문은 Netlify에 저장해 두고 다시 씀 (천문 자료는 날짜별로 정해져 있어서 오래 둬도 됨)
const CACHE_SECONDS = { rise: 60 * 60 * 12, alt: 60 * 60 * 12, event: 60 * 60 * 24 };

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
  return new Response(await res.text(), {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
      ...(res.ok ? { "netlify-cdn-cache-control": `public, s-maxage=${CACHE_SECONDS[name]}, durable` } : {}),
    },
  });
};

export const config = { path: "/api/:name" };
