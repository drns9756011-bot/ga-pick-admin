(() => {
  const form = document.querySelector("#requestForm");
  if (!form) return;

  const field = (name) => form.querySelector(`[name="${name}"]`);
  const fields = {
    quoteType: field("quoteType"),
    items: field("items"),
    aiSituation: field("aiSituation"),
    familyComposition: field("familyComposition"),
    budgetStatus: field("budgetStatus"),
    budgetRange: field("budgetRange"),
    purchasePriority: field("purchasePriority"),
    aiRequestSummary: field("aiRequestSummary"),
    aiModelRecommendations: ensureHiddenField("aiModelRecommendations"),
    recommendationMode: ensureHiddenField("recommendationMode"),
    image: field("quoteImage"),
    customer: field("customer"),
    phone: field("phone"),
    purpose: field("purchasePurpose"),
    brand: field("desiredBrand"),
    price: field("price"),
    region: field("region"),
    installDate: field("installDate"),
    memo: field("memo"),
  };

  const message = form.querySelector("#requestFormMessage") || document.createElement("p");
  const previewTitle = document.querySelector("#previewTitle");
  const previewMeta = document.querySelector("#previewMeta");
  const imagePreview = document.querySelector("#imagePreview");

  const state = {
    stepIndex: 0,
    selectedProducts: [],
    productOptions: {},
    aiContext: {
      situation: "",
      family: [],
      budgetStatus: "",
      budgetRange: "",
      priorities: [],
      note: "",
    },
    catalogs: {},
    lowestPriceCache: new Map(),
    modelLearning: null,
    productLearning: null,
    recommendationGroups: [],
    recommending: false,
    recommendationMode: "",
  };

  async function fetchWithTimeout(path, options = {}, timeoutMs = 16000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(path, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const quoteTypes = [
    {
      value: "with_quote",
      title: "견적서가 있어요",
      text: "받은 견적서 사진을 올려 판매자 제안가와 혜택을 비교합니다.",
      badge: "정확한 견적 가능",
    },
    {
      value: "without_quote",
      title: "견적서가 없어요",
      text: "품목과 옵션을 선택해 비교 요청합니다. LG·삼성 단일 브랜드는 AI 모델 추천을 지원합니다.",
      badge: "",
    },
  ];

  const purposeOptions = [
    { value: "웨딩,혼수 특별혜택", title: "웨딩,혼수", text: "혼수 패키지 조건과 카드 혜택을 함께 비교합니다.", badge: "특별혜택" },
    { value: "신축입주 특별혜택", title: "신축입주", text: "입주 일정에 맞춘 배송, 설치 조건을 확인합니다.", badge: "특별혜택" },
    { value: "이사", title: "이사", text: "이사 일정에 맞춰 필요한 품목을 비교합니다." },
    { value: "인테리어", title: "인테리어", text: "공간과 빌트인 조건을 기준으로 비교합니다." },
    { value: "일반", title: "일반", text: "교체와 단품 구매 조건을 비교합니다." },
  ];

  const brandOptions = [
    { value: "LG전자", title: "LG전자", text: "LG전자 제품 중심으로 제안을 받고 싶어요." },
    { value: "삼성전자", title: "삼성전자", text: "삼성전자 제품 중심으로 제안을 받고 싶어요." },
    { value: "비교견적", title: "비교견적", text: "LG와 삼성 조건을 함께 비교하고 싶어요." },
  ];

  const productOptions = [
    { value: "TV", title: "TV", icon: "TV", thumb: "tv" },
    { value: "라이프스타일 TV", title: "라이프스타일 TV", icon: "LS", thumb: "lifestyle" },
    { value: "냉장고", title: "냉장고", icon: "냉", thumb: "fridge" },
    { value: "김치냉장고", title: "김치냉장고", icon: "김", thumb: "kimchi" },
    { value: "세탁기/건조기", title: "세탁기 / 건조기", icon: "세", thumb: "washer" },
    { value: "의류관리기", title: "의류관리기", icon: "의", thumb: "styler" },
    { value: "에어컨", title: "에어컨", icon: "에", thumb: "aircon" },
    { value: "청소기", title: "청소기", icon: "청", thumb: "vacuum" },
    { value: "식기세척기", title: "식기세척기", icon: "식", thumb: "dishwasher" },
    { value: "인덕션/전기레인지", title: "인덕션", icon: "인", thumb: "induction" },
    { value: "오븐 / 전자레인지", title: "오븐 / 전자레인지", icon: "오", thumb: "oven" },
    { value: "공기청정기", title: "공기청정기", icon: "공", thumb: "purifier" },
    { value: "정수기", title: "정수기", icon: "정", thumb: "water" },
  ];

  const unknownOption = "상세 옵션 미입력";
  const brandProductTitles = {
    "LG전자": {
      "라이프스타일 TV": "스탠바이미",
      "세탁기/건조기": "세탁기 / 건조기",
      "의류관리기": "스타일러",
      "인덕션/전기레인지": "인덕션",
    },
    "삼성전자": {
      "라이프스타일 TV": "더 무빙스타일",
      "세탁기/건조기": "세탁기 / 건조기",
      "의류관리기": "에어드레서",
      "인덕션/전기레인지": "인덕션",
    },
  };

  const brandOptionSchema = {
    "LG전자": {
      "TV": [
        { mode: "single", key: "type", label: "유형", options: ["QNED", "OLED", "MRGB"] },
        {
          mode: "singleBy",
          key: "size",
          label: "인치",
          dependsOn: "type",
          optionsByValue: {
            "QNED": ["32인치", "43인치", "55인치", "65인치", "75인치", "85인치", "100인치"],
            "OLED": ["42인치", "48인치", "55인치", "65인치", "77인치", "83인치", "98인치"],
            "MRGB": ["55인치", "65인치", "75인치", "85인치", "100인치"],
          },
        },
      ],
      "스탠바이미": [
        { mode: "single", key: "type", label: "유형", options: ["스탠바이미", "스탠바이미 GO"] },
        {
          mode: "singleBy",
          key: "size",
          label: "인치",
          dependsOn: "type",
          optionsByValue: { "스탠바이미": ["27인치", "32인치"], "스탠바이미 GO": ["27인치"] },
        },
      ],
      "냉장고": [
        { mode: "single", key: "type", label: "유형", options: ["상냉장", "핏앤맥스", "양문형", "컨버터블"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: {
            "상냉장": ["얼음정수기 냉장고", "얼음 냉장고", "노크온", "일반"],
            "핏앤맥스": ["노크온", "일반"],
            "양문형": ["얼음정수기 냉장고", "일반"],
          },
        },
      ],
      "김치냉장고": [
        { mode: "single", key: "type", label: "유형", options: ["뚜껑식", "스탠드", "컨버터블"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: {
            "뚜껑식": ["1도어", "2도어"],
            "스탠드": ["핏앤맥스 3도어", "핏앤맥스 4도어", "일반 3도어", "일반 4도어"],
          },
        },
      ],
      "세탁기 / 건조기": [
        { mode: "single", key: "type", label: "유형", options: ["워시타워", "콤보", "분리형(세탁기/건조기)", "드럼세탁기", "일반세탁기"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          labelByValue: { "콤보": "유형" },
          dependsOn: "type",
          optionsByValue: {
            "워시타워": ["옵션형", "AI"],
            "콤보": ["미니워시 포함", "미포함"],
            "분리형(세탁기/건조기)": ["오브제", "일반"],
            "드럼세탁기": ["오브제", "일반"],
            "일반세탁기": ["17KG", "19KG", "21KG", "25KG"],
          },
        },
      ],
      "스타일러": [
        { mode: "single", key: "capacity", label: "유형", options: ["3벌", "5벌"] },
        { mode: "single", key: "finish", label: "유형", options: ["미러", "일반"] },
        {
          mode: "singleBy",
          key: "steamer",
          label: "유형",
          dependsOn: "capacity",
          optionsByValue: { "5벌": ["스티머 O", "스티머 X"] },
        },
      ],
      "에어컨": [
        { mode: "single", key: "type", label: "구분", options: ["2IN1", "스탠드", "벽걸이", "천장형"] },
        {
          mode: "singleBy",
          key: "area",
          label: "평형",
          dependsOn: "type",
          optionsByValue: {
            "2IN1": ["18평형", "22평형", "25평형"],
            "스탠드": ["18평형", "22평형", "25평형"],
            "벽걸이": ["6평형", "7평형", "9평형", "11평형", "13평형", "16평형"],
          },
        },
        { mode: "singleBy", key: "quantity", label: "수량", dependsOn: "type", optionsByValue: { "천장형": ["2", "3", "4", "5", "6"] } },
      ],
      "청소기": [
        { mode: "single", key: "type", label: "구분", options: ["무선 청소기", "로봇 청소기", "유선 청소기"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: {
            "무선 청소기": ["기본형", "먼지흡입", "프리이미엄"],
            "로봇 청소기": ["프리스탠딩", "직배수형"],
          },
        },
      ],
      "식기세척기": [
        { mode: "single", key: "type", label: "구분", options: ["빝트인", "프리스탠드", "카운터탑"] },
        { mode: "singleBy", key: "toeKick", label: "걸레받이", dependsOn: "type", optionsByValue: { "빝트인": ["10CM", "15CM", "잘모르겠어요"] } },
      ],
      "인덕션": [
        { mode: "single", key: "install", label: "구분", options: ["빌트인", "프리스탠딩"] },
        { mode: "single", key: "heatType", label: "구분", options: ["인덕션", "하이브리드"] },
        { mode: "singleBy", key: "height", label: "구분", dependsOn: "install", optionsByValue: { "프리스탠딩": ["3cm", "8cm", "15cm", "잘모르겠어요"] } },
      ],
      "오븐 / 전자레인지": [
        { mode: "single", key: "type", label: "구분", options: ["복합오븐", "전자레인지"] },
      ],
      "공기청정기": [
        { mode: "single", key: "type", label: "구분", options: ["1단", "2단"] },
        { mode: "singleBy", key: "area", label: "평수", dependsOn: "type", optionsByValue: { "1단": ["20평형", "18평형"], "2단": ["35평형", "28평형"] } },
      ],
      "정수기": [
        { mode: "single", key: "install", label: "구분", options: ["빌트인", "스탠드"] },
        {
          mode: "singleBy",
          key: "function",
          label: "구분",
          dependsOn: "install",
          optionsByValue: { "빌트인": ["냉,온,정수", "냉,정수"], "스탠드": ["얼음정수기", "냉,온,정수", "냉,정수"] },
        },
      ],
    },
    "삼성전자": {
      "TV": [
        { mode: "single", key: "type", label: "유형", options: ["NEO QLED", "OLED", "MRGB"] },
        { mode: "single", key: "install", label: "구분", options: ["벽걸이", "스탠드"] },
        {
          mode: "singleBy",
          key: "size",
          label: "인치",
          dependsOn: "type",
          optionsByValue: {
            "NEO QLED": ["43인치", "50인치", "55인치", "65인치", "75인치", "85인치", "100인치"],
            "OLED": ["42인치", "48인치", "55인치", "65인치", "77인치", "83인치"],
            "MRGB": ["65인치", "75인치", "85인치", "100인치", "115인치"],
          },
        },
      ],
      "더 무빙스타일": [
        { mode: "single", key: "size", label: "구분", options: ["27인치"] },
      ],
      "냉장고": [
        { mode: "single", key: "type", label: "유형", options: ["상냉장", "키친핏 맥스", "양문형", "1도어"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: {
            "상냉장": ["패밀리허브", "하이브리드"],
            "키친핏 맥스": ["하이브리드"],
            "양문형": ["정수기 냉장고", "일반"],
            "1도어": ["인피니티", "일반"],
          },
        },
      ],
      "김치냉장고": [
        { mode: "single", key: "type", label: "유형", options: ["뚜껑식", "스탠드", "1도어"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: {
            "뚜껑식": ["1도어", "2도어"],
            "스탠드": ["키친핏 3도어", "키친핏 4도어", "일반 3도어", "일반 4도어"],
          },
        },
      ],
      "세탁기 / 건조기": [
        { mode: "single", key: "type", label: "유형", options: ["원바디", "콤보", "분리형(세탁기/건조기)", "드럼세탁기", "일반세탁기"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          labelByValue: { "콤보": "유형" },
          dependsOn: "type",
          optionsByValue: {
            "원바디": ["인피니트", "AI"],
            "콤보": ["25KG / 20KG", "25KG / 22KG"],
            "분리형(세탁기/건조기)": ["AI 맞춤 25KG / 22KG", "25KG / 20KG"],
            "드럼세탁기": ["AI맞춤 25KG", "25KG"],
            "일반세탁기": ["19KG", "21KG", "23KG", "25KG"],
          },
        },
      ],
      "에어드레서": [
        { mode: "single", key: "capacity", label: "유형", options: ["9벌 + 3벌", "9벌 + 2벌"] },
        { mode: "single", key: "finish", label: "유형", options: ["미러", "일반"] },
        { mode: "singleBy", key: "crease", label: "유형", dependsOn: "capacity", optionsByValue: { "9벌 + 2벌": ["주름집중 O", "주름집중 X"] } },
      ],
      "에어컨": [
        { mode: "single", key: "type", label: "구분", options: ["2IN1(무풍)", "2IN1(일반)", "스탠드", "벽걸이", "천장형"] },
        {
          mode: "singleBy",
          key: "area",
          label: "평형",
          dependsOn: "type",
          optionsByValue: {
            "2IN1(무풍)": ["17평형", "19평형", "20평형", "22평형", "25평형"],
            "2IN1(일반)": ["17평형", "19평형", "20평형", "22평형", "25평형"],
            "스탠드": ["17평형", "19평형", "20평형", "22평형", "25평형"],
            "벽걸이": ["6평형", "7평형", "9평형", "11평형", "13평형", "16평형"],
          },
        },
        { mode: "singleBy", key: "quantity", label: "수량", dependsOn: "type", optionsByValue: { "천장형": ["2", "3", "4", "5", "6"] } },
      ],
      "청소기": [
        { mode: "single", key: "type", label: "구분", options: ["무선 청소기", "로봇 청소기", "유선 청소기"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: {
            "무선 청소기": ["제트 400W", "제트 Lite 280W", "제트 핏 180W"],
            "로봇 청소기": ["일반", "자동급배수"],
          },
        },
      ],
      "식기세척기": [
        { mode: "single", key: "type", label: "구분", options: ["빝트인", "카운터탑"] },
        { mode: "singleBy", key: "toeKick", label: "걸레받이", dependsOn: "type", optionsByValue: { "빝트인": ["10CM", "15CM", "잘모르겠어요"] } },
      ],
      "인덕션": [
        { mode: "single", key: "install", label: "구분", options: ["빌트인", "프리스탠딩"] },
        { mode: "single", key: "heatType", label: "구분", options: ["인덕션", "인피니트"] },
        { mode: "singleBy", key: "height", label: "구분", dependsOn: "install", optionsByValue: { "프리스탠딩": ["3cm", "8cm", "15cm", "잘모르겠어요"] } },
      ],
      "오븐 / 전자레인지": [
        { mode: "single", key: "type", label: "구분", options: ["복합오븐", "전자레인지"] },
      ],
      "공기청정기": [
        { mode: "single", key: "type", label: "구분", options: ["인피니트", "블루스카이"] },
        { mode: "singleBy", key: "area", label: "평수", dependsOn: "type", optionsByValue: { "인피니트": ["10평형", "24평형", "30평형"], "블루스카이": ["10평형", "18평형"] } },
      ],
      "정수기": [
        { mode: "single", key: "install", label: "구분", options: ["빌트인", "스탠드"] },
        {
          mode: "singleBy",
          key: "function",
          label: "구분",
          dependsOn: "install",
          optionsByValue: { "빌트인": ["냉,온,정수", "냉,정수", "정수"], "스탠드": ["얼음정수기", "냉,온,정수"] },
        },
      ],
    },
    "비교견적": {
      "TV": [
        { mode: "single", key: "type", label: "유형", options: ["기본형", "프리미엄", "기본형 플러스"] },
        { mode: "single", key: "install", label: "구분", options: ["벽걸이", "스탠드"] },
        {
          mode: "singleBy",
          key: "size",
          label: "인치",
          dependsOn: "type",
          optionsByValue: {
            "기본형": ["40인치", "50인치", "55인치", "65인치", "75인치", "85인치", "100인치"],
            "프리미엄": ["42인치", "48인치", "55인치", "65인치", "77인치", "83인치"],
            "기본형 플러스": ["65인치", "75인치", "85인치", "100인치", "115인치"],
          },
        },
      ],
      "라이프스타일 TV": [
        { mode: "single", key: "type", label: "유형", options: ["기본형", "포터블"] },
        {
          mode: "singleBy",
          key: "size",
          label: "인치",
          dependsOn: "type",
          optionsByValue: { "기본형": ["27인치", "32인치"], "포터블": ["27인치"] },
        },
      ],
      "냉장고": [
        { mode: "single", key: "type", label: "유형", options: ["상냉장", "빌트인", "양문형", "1도어"] },
      ],
      "김치냉장고": [
        { mode: "single", key: "type", label: "유형", options: ["뚜껑식", "스탠드", "1도어"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: {
            "뚜껑식": ["1도어", "2도어"],
            "스탠드": ["빌트인 3도어", "빌트인 4도어", "일반 3도어", "일반 4도어"],
          },
        },
      ],
      "세탁기 / 건조기": [
        { mode: "single", key: "type", label: "유형", options: ["일체형(워시타워,원바디)", "복합형(콤보)", "분리형(세탁기/건조기)", "드럼세탁기", "일반세탁기"] },
      ],
      "의류관리기": [
        { mode: "single", key: "capacity", label: "유형", options: ["3벌", "5벌"] },
        { mode: "single", key: "finish", label: "유형", options: ["미러", "일반"] },
      ],
      "에어컨": [
        { mode: "single", key: "type", label: "구분", options: ["2IN1", "스탠드", "벽걸이", "천장형"] },
        {
          mode: "singleBy",
          key: "area",
          label: "평형",
          dependsOn: "type",
          optionsByValue: {
            "2IN1": ["17평형", "18평형", "22평형", "25평형"],
            "스탠드": ["17평형", "18평형", "22평형", "25평형"],
            "벽걸이": ["6평형", "7평형", "9평형", "11평형", "13평형", "16평형"],
          },
        },
        { mode: "singleBy", key: "quantity", label: "수량", dependsOn: "type", optionsByValue: { "천장형": ["2", "3", "4", "5", "6"] } },
      ],
      "청소기": [
        { mode: "single", key: "type", label: "구분", options: ["무선 청소기", "로봇 청소기", "유선 청소기"] },
        {
          mode: "singleBy",
          key: "detail",
          label: "구분",
          dependsOn: "type",
          optionsByValue: { "로봇 청소기": ["일반", "자동급배수"] },
        },
      ],
      "식기세척기": [
        { mode: "single", key: "type", label: "구분", options: ["빝트인", "카운터탑"] },
        {
          mode: "singleBy",
          key: "toeKick",
          label: "걸레받이",
          dependsOn: "type",
          optionsByValue: {
            "빝트인": ["10CM", "15CM", "잘모르겠어요"],
            "카운터탑": ["3cm", "8cm", "15cm", "잘모르겠어요"],
          },
        },
      ],
      "인덕션": [
        { mode: "single", key: "install", label: "구분", options: ["빌트인", "프리스탠딩"] },
        { mode: "single", key: "heatType", label: "구분", options: ["인덕션", "하이브리드"] },
        { mode: "singleBy", key: "height", label: "구분", dependsOn: "install", optionsByValue: { "프리스탠딩": ["3cm", "8cm", "15cm", "잘모르겠어요"] } },
      ],
      "오븐 / 전자레인지": [
        { mode: "single", key: "type", label: "구분", options: ["복합오븐", "전자레인지"] },
      ],
      "공기청정기": [
        { mode: "single", key: "area", label: "구분", options: ["10평형", "18평형", "20평형", "24평형", "30평형", "35평형"] },
      ],
      "정수기": [
        { mode: "single", key: "install", label: "구분", options: ["빌트인", "스탠드"] },
        {
          mode: "singleBy",
          key: "function",
          label: "구분",
          dependsOn: "install",
          optionsByValue: {
            "빌트인": ["냉,온,정수", "냉,정수", "정수"],
            "스탠드": ["얼음정수기", "냉,온,정수"],
          },
        },
      ],
    },
  };

  const aiSituations = ["혼수/웨딩", "신축 입주", "이사", "교체", "사업장/B2B"];
  const familyOptions = ["1인", "2인", "3~4인", "5인 이상", "아이 있음", "반려동물 있음"];
  const priorityOptions = ["가격", "설치 일정", "배송", "카드 혜택", "공간 맞춤", "프리미엄"];

  const steps = [
    { key: "quoteType", render: renderQuoteType, validate: validateQuoteType },
    { key: "personal", render: renderPersonal, validate: validatePersonal },
    { key: "purpose", render: renderPurpose, validate: validatePurpose },
    { key: "brand", render: renderBrand, validate: validateBrand },
    { key: "products", render: renderProducts, validate: validateProducts, show: isWithoutQuote },
    { key: "options", render: renderOptions, validate: validateOptions, show: isWithoutQuote },
    { key: "recommendationMode", render: renderRecommendationMode, validate: validateRecommendationMode, show: shouldChooseRecommendationMode },
    { key: "ai", render: renderAiContext, validate: validateAiContext, show: shouldUseAiRecommendation },
    { key: "manualBudget", render: renderManualBudget, validate: validateManualBudget, show: isManualWithoutQuote },
    { key: "comparisonBudget", render: renderComparisonBudget, validate: validateComparisonBudget, show: isComparisonWithoutQuote },
    { key: "quoteInfo", render: renderQuoteInfo, validate: validateQuoteInfo },
  ];

  installWizard();

  function installWizard() {
    const wizard = document.createElement("div");
    wizard.className = "customer-wizard quote-wizard";
    form.prepend(wizard);
    form.dataset.wizardReady = "true";
    form._wizardSubmitAllowed = false;

    bindNativeFields();
    form.addEventListener("pickquote:wizard-reset", resetWizardState);
    hideNativeFields();
    render();
    syncAllFields();
  }

  function resetWizardState() {
    state.stepIndex = 0;
    state.selectedProducts = [];
    state.productOptions = {};
    state.aiContext = {
      situation: "",
      family: [],
      budgetStatus: "",
      budgetRange: "",
      priorities: [],
      note: "",
    };
    state.recommendationGroups = [];
    state.recommending = false;
    state.recommendationMode = "";
    form._wizardSubmitAllowed = false;
    fields.aiModelRecommendations.value = "";
    fields.recommendationMode.value = "";
    fields.price.value = "0";
    syncAllFields();
    render();
  }

  function ensureHiddenField(name) {
    let input = field(name);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.prepend(input);
    }
    return input;
  }

  function bindNativeFields() {
    fields.phone?.addEventListener("input", () => {
      fields.phone.value = formatPhoneInput(fields.phone.value);
    });

    form.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" || event.target?.tagName === "TEXTAREA") return;
        event.preventDefault();
      },
      true
    );

    form.addEventListener(
      "submit",
      (event) => {
        syncAllFields();
        if (!isFinalVisibleStep()) {
          event.preventDefault();
          move(1);
          return;
        }
        if (!validateCurrentStep()) {
          event.preventDefault();
          return;
        }
        form._wizardSubmitAllowed = true;
      },
      true
    );
  }

  function hideNativeFields() {
    [
      fields.image?.closest(".upload-box"),
      fields.customer?.closest("label"),
      fields.phone?.closest("label"),
      fields.purpose?.closest("label"),
      fields.brand?.closest("label"),
      fields.price?.closest("label"),
      fields.region?.closest("label"),
      fields.installDate?.closest("label"),
      fields.memo?.closest("label"),
    ]
      .filter(Boolean)
      .forEach((element) => {
        element.classList.add("wizard-native-hidden");
      });
  }

  function visibleSteps() {
    return steps.filter((step) => !step.show || step.show());
  }

  function currentStep() {
    const list = visibleSteps();
    state.stepIndex = Math.min(state.stepIndex, list.length - 1);
    return list[state.stepIndex];
  }

  function isFinalVisibleStep() {
    return state.stepIndex === visibleSteps().length - 1;
  }

  function render() {
    const step = currentStep();
    const list = visibleSteps();
    const wizard = form.querySelector(".customer-wizard");
    const busyAttr = state.recommending ? "disabled aria-disabled=\"true\"" : "";
    wizard.innerHTML = `
      <div class="wizard-progress" style="--wizard-step-count:${list.length}" aria-label="견적 등록 진행 단계">
        ${list.map((_, index) => `<span class="${index <= state.stepIndex ? "is-active" : ""}"></span>`).join("")}
      </div>
      <div class="wizard-step-label">Step ${state.stepIndex + 1}</div>
      <div class="wizard-step" data-step="${step.key}">${step.render()}</div>
      <div class="wizard-actions">
        ${state.stepIndex > 0 ? '<button type="button" class="wizard-back">이전</button>' : ""}
        <button type="${isFinalVisibleStep() ? "submit" : "button"}" class="wizard-next primary-btn" ${busyAttr}>${state.recommending ? "AI 추천 중" : isFinalVisibleStep() ? "견적 요청 등록" : "다음"}</button>
      </div>
    `;

    wizard.querySelector(".wizard-back")?.addEventListener("click", () => move(-1));
    wizard.querySelector(".wizard-next")?.addEventListener("click", (event) => {
      if (!isFinalVisibleStep()) {
        event.preventDefault();
        move(1);
      }
    });

    bindStepEvents(wizard, step.key);
    updateNativeRequirement();
    updatePreview();
  }

  function isMobileWizardViewport() {
    return window.matchMedia?.("(max-width: 720px)")?.matches ?? window.innerWidth <= 720;
  }

  function guardMobileStepScroll(previousScrollY) {
    if (!isMobileWizardViewport()) return;

    const preventDownwardJump = () => {
      // 단계 전환 직후 DOM 높이가 달라지면 모바일 Safari/Chrome의
      // scroll anchoring이 클릭 지점을 따라 아래로 이동시키는 경우가 있다.
      // 사용자가 누르기 직전 위치보다 아래로 밀린 경우에만 원래 위치로 복원한다.
      if (window.scrollY > previousScrollY + 2) {
        window.scrollTo({ top: previousScrollY, left: window.scrollX, behavior: "auto" });
      }
    };

    preventDownwardJump();
    requestAnimationFrame(() => {
      preventDownwardJump();
      requestAnimationFrame(preventDownwardJump);
    });
    [60, 140, 260].forEach((delay) => window.setTimeout(preventDownwardJump, delay));
  }

  function move(delta) {
    if (delta > 0 && !validateCurrentStep()) return;

    const mobile = isMobileWizardViewport();
    const previousScrollY = mobile ? window.scrollY : 0;

    // 키보드/포커스가 남아 있는 상태에서 단계 DOM이 교체되면 iOS Safari가
    // 포커스 위치를 맞추기 위해 추가 스크롤을 만들 수 있으므로 먼저 해제한다.
    if (mobile && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    state.stepIndex = Math.max(0, Math.min(visibleSteps().length - 1, state.stepIndex + delta));
    render();

    if (mobile) guardMobileStepScroll(previousScrollY);
  }

  function validateCurrentStep() {
    clearMessage();
    syncAllFields();
    const step = currentStep();
    const ok = step.validate();
    updatePreview();
    return ok;
  }

  function setMessage(text) {
    if (!message) return;
    message.textContent = text;
    message.dataset.type = text ? "error" : "";
  }

  function clearMessage() {
    setMessage("");
  }

  function renderQuoteType() {
    const brandGuide = fields.quoteType.value === "without_quote"
      ? `
        <aside class="wizard-brand-guide">
          <div class="wizard-brand-guide-copy">
            <span>제품 선택이 막막하신가요?</span>
            <strong>브랜드관에서 제품과 패키지를 먼저 살펴보세요.</strong>
            <p>제품을 살펴본 뒤 필요한 품목만 선택해 견적을 요청할 수 있습니다.</p>
          </div>
          <div class="wizard-brand-guide-links">
            <a href="/brand"><img src="/assets/brand-hero-lg-products.png" alt="LG전자 제품" /><span>LG전자 브랜드관</span></a>
            <a href="/brand"><img src="/assets/brand-hero-samsung-products.png" alt="삼성전자 제품" /><span>삼성전자 브랜드관</span></a>
          </div>
        </aside>
      `
      : "";
    return `
      <h3>견적서가 있는지 먼저 선택해주세요.</h3>
      <p>견적서 유무에 따라 필요한 입력 단계가 달라집니다.</p>
      <div class="wizard-choice-grid wizard-choice-grid-two">
        ${quoteTypes.map((item) => choiceCard(item, "wizardQuoteTypeProxy", fields.quoteType.value)).join("")}
      </div>
      ${brandGuide}
    `;
  }

  function renderPersonal() {
    return `
      <h3>고객님 정보를 입력해주세요.</h3>
      <p>내 견적 확인과 알림 안내에 필요한 최소 정보만 받습니다.</p>
      <div class="wizard-field-grid">
        <label>고객님 성함<input type="text" data-wizard-field="customer" value="${escapeHtml(fields.customer.value)}" placeholder="예: 홍길동" /></label>
        <label>연락처<input type="text" data-wizard-field="phone" value="${escapeHtml(fields.phone.value)}" placeholder="010-0000-0000" /></label>
      </div>
    `;
  }

  function renderPurpose() {
    return `
      <h3>구매 목적을 선택해주세요.</h3>
      <p>목적에 따라 비교해야 할 혜택과 일정 조건이 달라집니다.</p>
      <div class="wizard-choice-grid">${purposeOptions.map((item) => choiceCard(item, "wizardPurposeProxy", fields.purpose.value)).join("")}</div>
    `;
  }

  function renderBrand() {
    const description = isWithQuote()
      ? "견적서에 적힌 브랜드 기준으로 선택해주세요."
      : "LG전자와 삼성전자는 AI 후보 모델을 정리하고, 비교견적은 AI 추천 없이 선택한 옵션과 예산으로 판매자 제안을 받습니다.";
    return `
      <h3>브랜드를 선택해주세요.</h3>
      <p>${description}</p>
      <div class="wizard-choice-grid wizard-choice-grid-three">${brandOptions.map((item) => choiceCard(item, "wizardBrandProxy", fields.brand.value)).join("")}</div>
    `;
  }

  function renderProducts() {
    return `
      <h3>구매 예정 품목을 모두 선택해주세요.</h3>
      <p>견적서가 없는 고객님은 선택한 품목 기준으로 판매자에게 요청이 전달됩니다.</p>
      <div class="wizard-product-list">
        ${productOptions
          .map((product) => {
            const checked = state.selectedProducts.includes(product.value);
            return `
              <button type="button" class="wizard-product-card ${checked ? "is-selected" : ""}" data-product="${escapeHtml(product.value)}">
                <span class="wizard-checkbox" aria-hidden="true">${checked ? "✓" : ""}</span>
                <span class="product-thumb product-thumb-${escapeHtml(product.thumb)}" aria-hidden="true"><span>${escapeHtml(product.icon)}</span></span>
                <strong>${escapeHtml(productDisplayTitle(product.value))}</strong>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderOptions() {
    return `
      <h3>선택한 품목의 옵션을 확인해주세요.</h3>
      <p>선택한 각 품목의 옵션을 엑셀 기준 순서대로 모두 선택해주세요.</p>
      <div class="wizard-option-list">
        ${state.selectedProducts
          .map((product) => {
            const summary = productOptionSummary(product);
            return `
              <div class="wizard-option-row">
                <div>
                  <strong>${escapeHtml(productDisplayTitle(product, optionStateFor(product)))}</strong>
                  <span>${escapeHtml(summary || "옵션 미선택")}</span>
                </div>
                <button type="button" class="secondary-btn wizard-open-option" data-product="${escapeHtml(product)}">옵션 선택</button>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAiContext() {
    return `
      <h3>AI 추천에 필요한 상황을 알려주세요.</h3>
      <p>선택한 브랜드와 품목에 맞춰 후보 모델을 정리합니다.</p>
      <div class="wizard-choice-block">
        <h4>구매 목적</h4>
        <div class="wizard-chip-grid">${aiSituations.map((item) => chip(item, "ai-situation", state.aiContext.situation === item)).join("")}</div>
      </div>
      <div class="wizard-choice-block">
        <h4>가족 구성</h4>
        <div class="wizard-chip-grid">${familyOptions.map((item) => chip(item, "ai-family", state.aiContext.family.includes(item))).join("")}</div>
      </div>
      <div class="wizard-choice-block">
        <h4>예산</h4>
        <div class="wizard-chip-grid">
          ${["예산 확정", "예산 미정"].map((item) => chip(item, "ai-budget-status", state.aiContext.budgetStatus === item)).join("")}
        </div>
        <input class="wizard-inline-input" type="text" data-ai-budget-range value="${escapeHtml(state.aiContext.budgetRange)}" placeholder="예: 1,000만원대, 2,000만원 이하" />
      </div>
      <div class="wizard-choice-block">
        <h4>중요한 조건</h4>
        <div class="wizard-chip-grid">${priorityOptions.map((item) => chip(item, "ai-priority", state.aiContext.priorities.includes(item))).join("")}</div>
      </div>
      <label class="wizard-wide-label">추가 상황
        <textarea data-ai-note rows="4" placeholder="예: 34평 신축 입주, 주방은 핏앤맥스 선호, 11월 설치 예정">${escapeHtml(state.aiContext.note)}</textarea>
      </label>
    `;
  }

  function renderRecommendationMode() {
    const modes = [
      {
        value: "ai",
        title: "AI 추천 견적 받기",
        text: "선택한 품목, 옵션, 상황과 예산을 기준으로 실제 카탈로그의 후보 모델을 정리합니다.",
        badge: "모델 추천",
      },
      {
        value: "manual",
        title: "AI 추천 없이 직접 진행",
        text: "희망 견적 금액과 요청사항을 직접 입력해 판매자 제안을 받습니다.",
        badge: "직접 입력",
      },
    ];
    return `
      <h3>견적 요청 방식을 선택해주세요.</h3>
      <p>견적서가 없어도 AI 추천을 사용하지 않고 직접 금액을 입력할 수 있습니다.</p>
      <div class="wizard-choice-grid wizard-choice-grid-two">
        ${modes.map((item) => choiceCard(item, "wizardRecommendationModeProxy", state.recommendationMode)).join("")}
      </div>
    `;
  }

  function renderManualBudget() {
    const amount = directAmountDigits();
    return `
      <h3>희망 견적 금액을 입력해주세요.</h3>
      <p>AI 모델 추천 없이 선택한 품목과 옵션, 입력한 금액을 기준으로 판매자 제안을 받습니다.</p>
      <label class="wizard-wide-label">희망 견적 금액(만원)
        <input
          type="text"
          inputmode="numeric"
          autocomplete="off"
          data-manual-budget
          value="${escapeHtml(amount ? Number(amount).toLocaleString("ko-KR") : "")}"
          placeholder="예: 1,500"
        />
        <small>${amount ? `${Number(amount).toLocaleString("ko-KR")}만원, 약 ${(Number(amount) * 10000).toLocaleString("ko-KR")}원` : "만원 단위로 입력해주세요. 예: 1,500 입력 시 15,000,000원"}</small>
      </label>
    `;
  }

  function renderComparisonBudget() {
    const budget = Number(comparisonBudgetDigits()) > 0 ? comparisonBudgetDigits() : "";
    return `
      <h3>비교견적 예산을 입력해주세요.</h3>
      <p>AI 추천 없이 선택한 품목과 옵션을 기준으로 여러 판매자의 제안을 비교합니다.</p>
      <label class="wizard-wide-label">예산(만원)
        <input
          type="text"
          inputmode="numeric"
          autocomplete="off"
          data-comparison-budget
          value="${escapeHtml(budget ? Number(budget).toLocaleString("ko-KR") : "")}"
          placeholder="예: 1,500"
        />
        <small>${budget ? `${Number(budget).toLocaleString("ko-KR")}만원, 약 ${(Number(budget) * 10000).toLocaleString("ko-KR")}원` : "판매자가 예산 안에서 조건을 제안할 수 있도록 만원 단위로 입력해주세요."}</small>
      </label>
    `;
  }

  function renderQuoteInfo() {
    const showUpload = isWithQuote();
    const showAiNotice = shouldUseAiRecommendation();
    return `
      <h3>${showUpload ? "견적서 이미지와 설치 정보를 확인해주세요." : "설치 정보와 요청사항을 확인해주세요."}</h3>
      <p>${showAiNotice ? "AI가 고객님 상황에 맞는 추천 모델과 네이버 최저가 일반 구매가를 함께 정리합니다." : "판매자가 확인할 설치 일정과 요청사항을 입력해주세요."}</p>
      ${showUpload ? renderUploadBox() : ""}
      ${showAiNotice ? renderRecommendationPanel() : ""}
      ${
        showUpload
          ? `<label class="wizard-wide-label">기존 견적 금액(만원)
              <input
                type="text"
                inputmode="numeric"
                autocomplete="off"
                data-wizard-field="price"
                value="${escapeHtml(onlyDigits(fields.price.value) ? Number(onlyDigits(fields.price.value)).toLocaleString("ko-KR") : "")}"
                placeholder="예: 1,500"
              />
              <small>1,500 입력 시 15,000,000원으로 등록됩니다.</small>
            </label>`
          : ""
      }
      <div class="wizard-field-grid">
        <label>설치 지역<input type="text" data-wizard-field="region" value="${escapeHtml(fields.region.value)}" placeholder="서울 송파구" /></label>
        <label>설치 예정일<input type="text" data-wizard-field="installDate" value="${escapeHtml(fields.installDate.value)}" placeholder="예: 8월 말, 2026년 8월 15일" /></label>
      </div>
      <label class="wizard-wide-label">추가 요청사항
        <textarea data-wizard-field="memo" rows="4" placeholder="모델명을 입력해주세요.">${escapeHtml(fields.memo.value)}</textarea>
      </label>
    `;
  }

  function renderUploadBox() {
    const count = fields.image?.files?.length || 0;
    return `
      <label class="upload-box wizard-upload-proxy" for="quoteImage">
        <span class="upload-icon">+</span>
        <strong>견적서 이미지 선택</strong>
        <small>견적서가 있는 경우 최소 1장, 최대 4장까지 등록해야 합니다. 현재 ${count}장 선택됨</small>
      </label>
    `;
  }

  function renderRecommendationPanel() {
    const loading = state.recommending ? "<p>AI가 모델 후보를 정리하고 있습니다.</p>" : "";
    const body = state.recommendationGroups.length
      ? `${state.recommendationGroups
            .map(
              (group) => `
                <div class="ai-recommendation-group">
                  <strong>[${escapeHtml(group.displayProduct || group.product)}]</strong>
                  <span>${escapeHtml(group.optionSummary || "상세 옵션 미입력")}</span>
                  <ul>${group.models.map((model) => `<li>${renderModelWithPrice(model)}</li>`).join("")}</ul>
                </div>
              `
            )
            .join("")}
          ${renderRecommendationTotal(state.recommendationGroups)}`
      : "<p>마지막 단계에서 AI 추천 모델이 자동으로 정리됩니다.</p>";
    return `<div class="ai-recommendation-panel"><b>AI 추천 간이 견적서</b>${loading || body}</div>`;
  }

  function bindStepEvents(root, key) {
    root.querySelectorAll("input[data-choice-name]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.name === "wizardQuoteTypeProxy") {
          fields.quoteType.value = input.value;
          state.recommendationMode = "";
          fields.price.value = "0";
          if (input.value === "with_quote") {
            state.selectedProducts = [];
            state.productOptions = {};
            clearAiRecommendation();
          }
        }
        if (input.name === "wizardPurposeProxy") fields.purpose.value = input.value;
        if (input.name === "wizardBrandProxy") {
          const previousBrand = selectedBrandKey();
          fields.brand.value = input.value;
          state.recommendationMode = "";
          state.productOptions = {};
          if (isWithoutQuote()) fields.price.value = "0";
          if (previousBrand === "비교견적" || input.value === "비교견적") {
            state.aiContext.budgetStatus = "";
            state.aiContext.budgetRange = "";
          }
          clearAiRecommendation();
        }
        if (input.name === "wizardRecommendationModeProxy") {
          state.recommendationMode = input.value;
          fields.price.value = "0";
          clearAiRecommendation();
        }
        syncAllFields();
        render();
      });
    });

    root.querySelectorAll("[data-wizard-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const target = field(input.dataset.wizardField);
        if (!target) return;
        if (input.dataset.wizardField === "phone") {
          target.value = formatPhoneInput(input.value);
          input.value = target.value;
        } else if (input.dataset.wizardField === "price") {
          const digits = onlyDigits(input.value).slice(0, 8);
          target.value = digits;
          input.value = digits ? Number(digits).toLocaleString("ko-KR") : "";
          const help = input.parentElement?.querySelector("small");
          if (help) {
            help.textContent = digits
              ? `${Number(digits).toLocaleString("ko-KR")}만원, 약 ${(Number(digits) * 10000).toLocaleString("ko-KR")}원`
              : "만원 단위로 입력해주세요. 예: 1,500 입력 시 15,000,000원";
          }
        } else {
          target.value = input.value;
        }
        updatePreview();
      });
    });

    root.querySelectorAll(".wizard-product-card").forEach((button) => {
      button.addEventListener("click", () => {
        const product = button.dataset.product;
        if (state.selectedProducts.includes(product)) {
          state.selectedProducts = state.selectedProducts.filter((item) => item !== product);
          deleteOptionState(product);
        } else {
          state.selectedProducts.push(product);
        }
        clearAiRecommendation();
        syncAllFields();
        render();
      });
    });

    root.querySelectorAll(".wizard-open-option").forEach((button) => {
      button.addEventListener("click", () => openOptionModal(button.dataset.product));
    });

    root.querySelectorAll("[data-ai-situation]").forEach((button) => {
      button.addEventListener("click", () => {
        state.aiContext.situation = button.dataset.aiSituation;
        syncAllFields();
        render();
      });
    });

    root.querySelectorAll("[data-ai-family]").forEach((button) => {
      button.addEventListener("click", () => toggleArray(state.aiContext.family, button.dataset.aiFamily));
    });

    root.querySelectorAll("[data-ai-budget-status]").forEach((button) => {
      button.addEventListener("click", () => {
        state.aiContext.budgetStatus = button.dataset.aiBudgetStatus;
        syncAllFields();
        render();
      });
    });

    root.querySelector("[data-ai-budget-range]")?.addEventListener("input", (event) => {
      state.aiContext.budgetRange = event.target.value;
      syncAllFields();
    });

    root.querySelector("[data-comparison-budget]")?.addEventListener("input", (event) => {
      const digits = onlyDigits(event.target.value).slice(0, 8);
      state.aiContext.budgetStatus = "예산 확정";
      state.aiContext.budgetRange = digits;
      event.target.value = digits ? Number(digits).toLocaleString("ko-KR") : "";
      syncAllFields();
      const help = event.target.parentElement?.querySelector("small");
      if (help) {
        help.textContent = digits
          ? `${Number(digits).toLocaleString("ko-KR")}만원, 약 ${(Number(digits) * 10000).toLocaleString("ko-KR")}원`
          : "판매자가 예산 안에서 조건을 제안할 수 있도록 만원 단위로 입력해주세요.";
      }
    });

    root.querySelector("[data-manual-budget]")?.addEventListener("input", (event) => {
      const digits = onlyDigits(event.target.value).slice(0, 8);
      fields.price.value = digits || "0";
      event.target.value = digits ? Number(digits).toLocaleString("ko-KR") : "";
      syncAllFields();
      const help = event.target.parentElement?.querySelector("small");
      if (help) {
        help.textContent = digits
          ? `${Number(digits).toLocaleString("ko-KR")}만원, 약 ${(Number(digits) * 10000).toLocaleString("ko-KR")}원`
          : "만원 단위로 입력해주세요. 예: 1,500 입력 시 15,000,000원";
      }
    });

    root.querySelectorAll("[data-ai-priority]").forEach((button) => {
      button.addEventListener("click", () => toggleArray(state.aiContext.priorities, button.dataset.aiPriority));
    });

    root.querySelector("[data-ai-note]")?.addEventListener("input", (event) => {
      state.aiContext.note = event.target.value;
      syncAllFields();
    });

    if (key === "quoteInfo" && shouldUseAiRecommendation() && !state.recommending && !state.recommendationGroups.length) {
      runAiRecommendation();
    }
  }

  function toggleArray(array, value) {
    const index = array.indexOf(value);
    if (index >= 0) array.splice(index, 1);
    else array.push(value);
    syncAllFields();
    render();
  }

  function choiceCard(item, name, currentValue) {
    const checked = currentValue === item.value;
    return `
      <label class="wizard-choice-card ${checked ? "is-selected" : ""} ${item.badge ? "has-badge" : ""}">
        <input type="radio" name="${name}" value="${escapeHtml(item.value)}" ${checked ? "checked" : ""} data-choice-name="${name}" />
        <span class="wizard-radio" aria-hidden="true">${checked ? "✓" : ""}</span>
        <span class="wizard-choice-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.text || "")}</small>
        </span>
        ${item.badge ? `<em>${escapeHtml(item.badge)}</em>` : ""}
      </label>
    `;
  }

  function chip(label, name, selected) {
    const attr = `data-${name}="${escapeHtml(label)}"`;
    return `<button type="button" class="wizard-chip ${selected ? "is-selected" : ""}" ${attr}>${escapeHtml(label)}</button>`;
  }

  function openOptionModal(product) {
    const draft = normalizeOptionDraft(optionStateFor(product));
    const modal = document.createElement("div");
    modal.className = "option-modal is-open";
    modal.innerHTML = `
      <div class="option-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(normalizeProductKey(product))} 옵션 선택">
        <button type="button" class="option-close" aria-label="닫기">×</button>
        <h3></h3>
        <div class="option-section-wrap"></div>
        <p class="option-validation" role="alert" hidden></p>
        <div class="option-actions">
          <button type="button" class="secondary-btn option-clear">선택 초기화</button>
          <button type="button" class="primary-btn option-save">확인</button>
        </div>
      </div>
    `;
    document.body.append(modal);
    document.body.classList.add("modal-open");

    const wrap = modal.querySelector(".option-section-wrap");
    const title = modal.querySelector("h3");
    const validation = modal.querySelector(".option-validation");
    const close = () => {
      modal.remove();
      document.body.classList.remove("modal-open");
    };
    const rerender = () => {
      const schema = optionSchemaFor(product, draft);
      pruneOptionDraft(schema, draft);
      title.textContent = productDisplayTitle(product, draft);
      validation.hidden = true;
      validation.textContent = "";
      const visibleSections = schema
        .map((section) => renderOptionSection(product, section, draft))
        .filter(Boolean)
        .join("");
      wrap.innerHTML = visibleSections || `<p class="option-empty">선택할 수 있는 옵션이 없습니다.</p>`;
      wrap.querySelectorAll(".option-row input").forEach((input) => {
        input.addEventListener("change", () => {
          const key = input.dataset.optionKey;
          const section = schema.find((item) => item.key === key);
          if (!section) return;
          if (isMultiOption(section)) {
            draft[key] = [...wrap.querySelectorAll(`[data-option-key="${cssEscape(key)}"]:checked`)].map((item) => item.value);
          } else {
            draft[key] = input.value;
          }
          if (key === "optionBrand") {
            Object.keys(draft).forEach((draftKey) => {
              if (draftKey !== "optionBrand") delete draft[draftKey];
            });
          }
          clearDependentOptionValues(schema, draft, key);
          clearAiRecommendation();
          rerender();
        });
      });
    };

    modal.querySelector(".option-close").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    modal.querySelector(".option-clear").addEventListener("click", () => {
      deleteOptionState(product);
      clearAiRecommendation();
      syncAllFields();
      close();
      render();
    });
    modal.querySelector(".option-save").addEventListener("click", () => {
      const schema = optionSchemaFor(product, draft);
      pruneOptionDraft(schema, draft);
      const missingSection = firstMissingOptionSection(schema, draft);
      if (missingSection) {
        validation.textContent = `${optionSectionLabel(missingSection, draft)} 항목을 선택해주세요.`;
        validation.hidden = false;
        modal.querySelector(`[data-option-key="${cssEscape(missingSection.key)}"]`)?.closest(".option-section")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
      writeOptionState(product, cleanOptionDraft(schema, draft));
      clearAiRecommendation();
      syncAllFields();
      close();
      render();
    });
    rerender();
  }

  function normalizeOptionDraft(source) {
    const draft = {};
    Object.entries(source || {}).forEach(([key, value]) => {
      draft[key] = Array.isArray(value) ? [...value] : value;
    });
    return draft;
  }

  function selectedBrandKey() {
    const raw = String(fields.brand.value || "");
    if (raw.includes("\uc0bc\uc131")) return "\uc0bc\uc131\uc804\uc790";
    if (raw.includes("\ube44\uad50")) return "\ube44\uad50\uacac\uc801";
    return "LG\uc804\uc790";
  }

  function normalizeProductKey(product) {
    const raw = String(product || "").trim().replace(/\s+/g, " ");
    const compact = raw.replace(/\s+/g, "").replace(/\+/g, "/");
    if (!compact) return raw;
    if (/^TV$/i.test(compact) || compact.includes("티비")) return "TV";
    if (compact.includes("\ub77c\uc774\ud504\uc2a4\ud0c0\uc77c") || compact.includes("\uc2a4\ud0e0\ubc14\uc774\ubbf8") || compact.includes("\ubb34\ube59\uc2a4\ud0c0\uc77c")) return "\ub77c\uc774\ud504\uc2a4\ud0c0\uc77c TV";
    if (compact.includes("\uae40\uce58\ub0c9\uc7a5\uace0")) return "\uae40\uce58\ub0c9\uc7a5\uace0";
    if (compact.includes("\ub0c9\uc7a5\uace0")) return "\ub0c9\uc7a5\uace0";
    if (compact.includes("\uc138\ud0c1") || compact.includes("\uac74\uc870")) return "\uc138\ud0c1\uae30/\uac74\uc870\uae30";
    if (compact.includes("\uc758\ub958") || compact.includes("\uc2a4\ud0c0\uc77c\ub7ec") || compact.includes("\uc5d0\uc5b4\ub4dc\ub808\uc11c")) return "\uc758\ub958\uad00\ub9ac\uae30";
    if (compact.includes("\uc5d0\uc5b4\ucee8")) return "\uc5d0\uc5b4\ucee8";
    if (compact.includes("\uccad\uc18c\uae30")) return "\uccad\uc18c\uae30";
    if (compact.includes("\uc2dd\uae30\uc138\ucc99")) return "\uc2dd\uae30\uc138\ucc99\uae30";
    if (compact.includes("\uacf5\uae30\uccad\uc815")) return "\uacf5\uae30\uccad\uc815\uae30";
    if (compact.includes("\uc815\uc218\uae30")) return "\uc815\uc218\uae30";
    if (compact.includes("\uc778\ub355\uc158") || compact.includes("\uc804\uae30\ub808\uc778\uc9c0")) return "\uc778\ub355\uc158/\uc804\uae30\ub808\uc778\uc9c0";
    if (compact.includes("\uc624\ube10") || compact.includes("\uc804\uc790\ub808\uc778\uc9c0")) return "\uc624\ube10 / \uc804\uc790\ub808\uc778\uc9c0";
    return raw;
  }

  function optionLookupAliases(product) {
    const productKey = normalizeProductKey(product);
    const manualAliases = {
      "라이프스타일 TV": ["라이프스타일TV", "스탠바이미", "더 무빙스타일"],
      "세탁기/건조기": ["세탁기+건조기", "세탁기 / 건조기", "세탁기건조기"],
      "의류관리기": ["스타일러", "에어드레서"],
      "인덕션/전기레인지": ["인덕션", "전기레인지", "인덕션 / 전기레인지"],
      "오븐 / 전자레인지": ["오븐/전자레인지", "오븐", "전자레인지"],
    };
    return [...new Set([
      productKey,
      product,
      productKey.replace(/\s*\/\s*/g, "/"),
      productKey.replace(/\//g, " / "),
      ...(manualAliases[productKey] || []),
    ].filter(Boolean))];
  }

  function optionStateFor(product) {
    return optionLookupAliases(product).reduce((found, key) => found || state.productOptions[key], null) || {};
  }

  function writeOptionState(product, value) {
    deleteOptionState(product);
    state.productOptions[normalizeProductKey(product)] = value;
  }

  function deleteOptionState(product) {
    optionLookupAliases(product).forEach((key) => {
      delete state.productOptions[key];
    });
  }

  function schemaProductTitleForBrand(product, brand) {
    const productKey = normalizeProductKey(product);
    const titles = {
      "LG전자": {
        "라이프스타일 TV": "스탠바이미",
        "세탁기/건조기": "세탁기 / 건조기",
        "의류관리기": "스타일러",
        "인덕션/전기레인지": "인덕션",
      },
      "삼성전자": {
        "라이프스타일 TV": "더 무빙스타일",
        "세탁기/건조기": "세탁기 / 건조기",
        "의류관리기": "에어드레서",
        "인덕션/전기레인지": "인덕션",
      },
      "비교견적": {
        "세탁기/건조기": "세탁기 / 건조기",
        "인덕션/전기레인지": "인덕션",
      },
    };
    return titles[brand]?.[productKey] || productKey;
  }

  function optionBrandFor(source) {
    const selected = selectedBrandKey();
    if (selected === "비교견적") return selected;
    const optionBrand = String(source?.optionBrand || "").trim();
    if (optionBrand === "LG전자" || optionBrand === "삼성전자") return optionBrand;
    return selected;
  }

  function productDisplayTitle(product, source) {
    const brand = optionBrandFor(source || optionStateFor(product));
    if (!brand) return normalizeProductKey(product);
    return schemaProductTitleForBrand(product, brand);
  }

  function schemaForBrand(product, brand) {
    if (!brandOptionSchema[brand]) return [];
    const exactTitle = schemaProductTitleForBrand(product, brand);
    return (brandOptionSchema[brand][exactTitle] || []).map(cloneOptionSection);
  }

  function optionSchemaFor(product, source) {
    const brand = optionBrandFor(source || optionStateFor(product));
    const schema = schemaForBrand(product, brand);
    if (schema.length) return schema;
    return [{ mode: "single", key: "detail", label: "상세 옵션", options: [unknownOption] }];
  }

  function cloneOptionSection(section) {
    const cloned = { ...section };
    if (Array.isArray(section.options)) cloned.options = [...section.options];
    if (Array.isArray(section.values)) cloned.values = [...section.values];
    const sourceByValue = section.optionsByValue || section.valuesByParent;
    if (sourceByValue) {
      cloned.optionsByValue = {};
      Object.entries(sourceByValue).forEach(([key, values]) => {
        cloned.optionsByValue[key] = Array.isArray(values) ? [...values] : [];
      });
    }
    if (section.labelByValue) cloned.labelByValue = { ...section.labelByValue };
    return cloned;
  }

  function isMultiOption(section) {
    return section.mode === "multi" || section.mode === "multiBy" || section.type === "multi";
  }

  function optionParentKey(section) {
    return section.dependsOn || section.parent || "";
  }

  function optionSectionLabel(section, draft) {
    const parentValue = draft?.[optionParentKey(section)];
    return section.labelByValue?.[parentValue] || section.label || section.title || "";
  }

  function sectionValues(section, draft) {
    if (Array.isArray(section.options)) return [...new Set(section.options)];
    if (Array.isArray(section.values)) return [...new Set(section.values)];
    const parentKey = optionParentKey(section);
    const valuesByParent = section.optionsByValue || section.valuesByParent;
    if (!parentKey || !valuesByParent) return [];
    const parentValue = draft[parentKey];
    const parents = Array.isArray(parentValue) ? parentValue : [parentValue].filter(Boolean);
    const values = parents.flatMap((item) => valuesByParent[item] || []);
    return [...new Set(values)];
  }

  function clearDependentOptionValues(schema, draft, changedKey) {
    const changedKeys = new Set([changedKey]);
    let changed = true;
    while (changed) {
      changed = false;
      schema.forEach((section) => {
        const parentKey = optionParentKey(section);
        if (!parentKey || !changedKeys.has(parentKey) || !Object.prototype.hasOwnProperty.call(draft, section.key)) return;
        delete draft[section.key];
        changedKeys.add(section.key);
        changed = true;
      });
    }
  }

  function pruneOptionDraft(schema, draft) {
    let changed = true;
    while (changed) {
      changed = false;
      schema.forEach((section) => {
        const values = sectionValues(section, draft);
        if (!values.length && optionParentKey(section)) {
          if (Object.prototype.hasOwnProperty.call(draft, section.key)) {
            delete draft[section.key];
            changed = true;
          }
          return;
        }
        if (isMultiOption(section)) {
          const current = Array.isArray(draft[section.key]) ? draft[section.key] : [];
          const next = current.filter((item) => values.includes(item));
          if (next.length !== current.length) {
            if (next.length) draft[section.key] = next;
            else delete draft[section.key];
            changed = true;
          }
          return;
        }
        if (draft[section.key] && !values.includes(draft[section.key])) {
          delete draft[section.key];
          changed = true;
        }
      });
    }
  }

  function cleanOptionDraft(schema, draft) {
    const next = {};
    schema.forEach((section) => {
      const values = sectionValues(section, draft);
      if (!values.length) return;
      if (isMultiOption(section)) {
        const selected = Array.isArray(draft[section.key]) ? draft[section.key].filter((item) => values.includes(item)) : [];
        if (selected.length) next[section.key] = selected;
        return;
      }
      if (draft[section.key] && values.includes(draft[section.key])) next[section.key] = draft[section.key];
    });
    return next;
  }

  function firstMissingOptionSection(schema, draft) {
    return schema.find((section) => {
      const values = sectionValues(section, draft);
      if (!values.length) return false;
      if (isMultiOption(section)) {
        const selected = Array.isArray(draft[section.key]) ? draft[section.key] : [];
        return !selected.some((value) => values.includes(value));
      }
      return !values.includes(draft[section.key]);
    });
  }

  function productOptionsAreComplete(product) {
    const options = normalizeOptionDraft(optionStateFor(product));
    const schema = optionSchemaFor(product, options);
    pruneOptionDraft(schema, options);
    return !firstMissingOptionSection(schema, options);
  }

  function renderOptionSection(product, section, draft) {
    const sectionValuesList = sectionValues(section, draft);
    if (!sectionValuesList.length) return "";
    const selectedValues = Array.isArray(draft[section.key]) ? draft[section.key] : [draft[section.key]].filter(Boolean);
    const inputType = isMultiOption(section) ? "checkbox" : "radio";
    const inputName = `option-${product}-${section.key}`;
    return `
      <section class="option-section">
        <h4>${escapeHtml(optionSectionLabel(section, draft))}</h4>
        ${sectionValuesList
          .map((value) => {
            const checked = selectedValues.includes(value);
            return `
              <label class="option-row">
                <span>${escapeHtml(value)}</span>
                <input type="${inputType}" data-option-key="${escapeHtml(section.key)}" name="${escapeHtml(inputName)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""} />
                <b aria-hidden="true">${checked ? "✓" : ""}</b>
              </label>
            `;
          })
          .join("")}
      </section>
    `;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  
function validateQuoteType() {
    if (fields.quoteType.value) return true;
    setMessage("견적서 유무를 선택해주세요.");
    return false;
  }

  function validatePersonal() {
    if (!fields.customer.value.trim()) {
      setMessage("고객님 성함을 입력해주세요.");
      return false;
    }
    if (onlyDigits(fields.phone.value).length < 9) {
      setMessage("연락처를 정확히 입력해주세요.");
      return false;
    }
    return true;
  }

  function validatePurpose() {
    if (fields.purpose.value) return true;
    setMessage("구매 목적을 선택해주세요.");
    return false;
  }

  function validateBrand() {
    if (fields.brand.value) return true;
    setMessage("브랜드를 선택해주세요.");
    return false;
  }

  function validateProducts() {
    if (state.selectedProducts.length) return true;
    setMessage("견적서가 없는 경우 구매 예정 품목을 선택해주세요.");
    return false;
  }

  function validateOptions() {
    const incompleteProduct = state.selectedProducts.find((product) => !productOptionsAreComplete(product));
    if (incompleteProduct) {
      setMessage(`${productDisplayTitle(incompleteProduct, optionStateFor(incompleteProduct))} 옵션을 모두 선택해주세요.`);
      return false;
    }
    return true;
  }

  function validateAiContext() {
    if (!shouldUseAiRecommendation()) return true;
    if (!state.aiContext.situation) {
      setMessage("AI 추천을 위해 구매 목적을 선택해주세요.");
      return false;
    }
    if (!state.aiContext.family.length) {
      setMessage("AI 추천을 위해 가족 구성을 선택해주세요.");
      return false;
    }
    if (!state.aiContext.budgetStatus) {
      setMessage("AI 추천을 위해 예산 여부를 선택해주세요.");
      return false;
    }
    return true;
  }

  function validateRecommendationMode() {
    if (!shouldChooseRecommendationMode() || ["ai", "manual"].includes(state.recommendationMode)) return true;
    setMessage("AI 추천 사용 여부를 선택해주세요.");
    return false;
  }

  function validateManualBudget() {
    const amount = Number(directAmountDigits());
    if (Number.isFinite(amount) && amount > 0) return true;
    setMessage("희망 견적 금액을 만원 단위로 입력해주세요.");
    return false;
  }

  function validateComparisonBudget() {
    const budget = Number(comparisonBudgetDigits());
    if (!Number.isFinite(budget) || budget <= 0) {
      setMessage("비교견적 예산을 만원 단위로 입력해주세요.");
      return false;
    }
    return true;
  }

  function validateQuoteInfo() {
    if (state.recommending) {
      setMessage("AI가 추천 모델을 찾고 있습니다. 잠시만 기다려주세요.");
      return false;
    }
    if (shouldUseAiRecommendation() && !state.recommendationGroups.length) {
      setMessage("AI 추천 모델이 아직 정리되지 않았습니다. 잠시 후 다시 시도해주세요.");
      runAiRecommendation();
      return false;
    }
    if (isWithQuote() && Number(onlyDigits(fields.price.value)) <= 0) {
      setMessage("기존 견적 금액을 만원 단위로 입력해주세요.");
      return false;
    }
    if (isManualWithoutQuote() && Number(directAmountDigits()) <= 0) {
      setMessage("희망 견적 금액을 만원 단위로 입력해주세요.");
      return false;
    }
    if (isWithQuote() && (!fields.image.files || !fields.image.files.length)) {
      setMessage("견적서가 있는 경우 견적서 이미지를 최소 1장 첨부해주세요.");
      return false;
    }
    if (!fields.region.value.trim()) {
      setMessage("설치 지역을 입력해주세요.");
      return false;
    }
    if (!fields.installDate.value.trim()) {
      setMessage("설치 예정일을 입력해주세요.");
      return false;
    }
    syncAllFields();
    return true;
  }

  function isWithQuote() {
    return fields.quoteType.value === "with_quote";
  }

  function isWithoutQuote() {
    return fields.quoteType.value === "without_quote";
  }

  function isComparisonWithoutQuote() {
    return isWithoutQuote() && selectedBrandKey() === "비교견적";
  }

  function isSingleBrandWithoutQuote() {
    return isWithoutQuote() && ["LG전자", "삼성전자"].includes(selectedBrandKey());
  }

  function shouldChooseRecommendationMode() {
    return isSingleBrandWithoutQuote();
  }

  function isManualWithoutQuote() {
    return isSingleBrandWithoutQuote() && state.recommendationMode === "manual";
  }

  function directAmountDigits() {
    return onlyDigits(fields.price.value);
  }

  function comparisonBudgetDigits() {
    return onlyDigits(state.aiContext.budgetRange || fields.price.value);
  }

  function shouldUseAiRecommendation() {
    return isSingleBrandWithoutQuote() && state.recommendationMode === "ai";
  }

  function updateNativeRequirement() {
    if (fields.image) fields.image.required = isWithQuote();
    if (fields.price) fields.price.required = isWithQuote() || isComparisonWithoutQuote() || isManualWithoutQuote();
  }

  function syncAllFields() {
    fields.items.value = buildItemsValue();
    fields.aiSituation.value = state.aiContext.situation;
    fields.familyComposition.value = state.aiContext.family.join(", ");
    fields.budgetStatus.value = state.aiContext.budgetStatus;
    fields.budgetRange.value = state.aiContext.budgetRange;
    fields.purchasePriority.value = state.aiContext.priorities.join(", ");
    fields.aiRequestSummary.value = buildAiSummary();
    fields.recommendationMode.value = state.recommendationMode;
    if (!shouldUseAiRecommendation()) fields.aiModelRecommendations.value = "";
    if (isComparisonWithoutQuote()) {
      const budget = comparisonBudgetDigits();
      fields.budgetStatus.value = "예산 확정";
      fields.budgetRange.value = budget;
      fields.price.value = budget || "0";
    }
    if (isManualWithoutQuote()) {
      const amount = directAmountDigits();
      fields.budgetStatus.value = "직접 금액 입력";
      fields.budgetRange.value = amount;
      fields.price.value = amount || "0";
    }
    if (isWithQuote()) {
      fields.items.value = "견적서 첨부";
    }
    updateNativeRequirement();
  }

  function buildItemsValue() {
    if (isWithQuote()) return "견적서 첨부";
    return state.selectedProducts
      .map((product) => {
        const summary = productOptionSummary(product);
        const title = productDisplayTitle(product, optionStateFor(product));
        return summary ? `${title} (${summary})` : title;
      })
      .join(", ");
  }

  function productOptionSummary(product) {
    const options = optionStateFor(product);
    const schema = optionSchemaFor(product, options);
    const parts = [];
    schema.forEach((section) => {
      const values = sectionValues(section, options);
      if (!values.length || section.key === "optionBrand") return;
      const selected = Array.isArray(options[section.key]) ? options[section.key] : [options[section.key]].filter(Boolean);
      selected.forEach((item) => {
        if (item && item !== unknownOption && values.includes(item)) parts.push(item);
      });
    });
    return [...new Set(parts)].join(" · ");
  }

  
function buildAiSummary() {
    if (!shouldUseAiRecommendation()) return "";
    const lines = [
      "고객의 상황에 맞춰 AI가 추천한 모델임을 알려드립니다.",
      state.aiContext.situation ? `구매 목적: ${state.aiContext.situation}` : "",
      state.aiContext.family.length ? `가족 구성: ${state.aiContext.family.join(", ")}` : "",
      state.aiContext.budgetStatus ? `예산: ${state.aiContext.budgetStatus}${state.aiContext.budgetRange ? ` (${state.aiContext.budgetRange})` : ""}` : "",
      state.aiContext.priorities.length ? `중요 조건: ${state.aiContext.priorities.join(", ")}` : "",
      state.aiContext.note ? `추가 상황: ${state.aiContext.note}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function clearAiRecommendation() {
    state.recommendationGroups = [];
    fields.aiModelRecommendations.value = "";
  }

  async function runAiRecommendation() {
    state.recommending = true;
    showAiRecommendationLoading();
    render();
    try {
      const groups = await buildAiModelRecommendations();
      state.recommendationGroups = groups;
      fields.aiModelRecommendations.value = recommendationsToText(groups);
      applyAutoLowestPrice(groups);
    } catch (error) {
      console.warn("AI recommendation failed", error);
      fields.aiModelRecommendations.value = fallbackRecommendationText();
      fields.price.value = "0";
    } finally {
      state.recommending = false;
      hideAiRecommendationLoading();
      syncAllFields();
      render();
    }
  }

  function showAiRecommendationLoading() {
    const modal = document.querySelector("#serverLoadingModal");
    const title = document.querySelector("#serverLoadingTitle");
    const text = document.querySelector("#serverLoadingText");
    const brandLabel = selectedAiBrandLabel();
    if (title) title.textContent = "AI가 추천모델을 찾는 중입니다.";
    if (text) text.textContent = `선택한 품목, 옵션, 예산을 기준으로 판매 가능한 ${brandLabel} 후보 모델을 정리하고 있습니다.`;
    if (modal) modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function hideAiRecommendationLoading() {
    const modal = document.querySelector("#serverLoadingModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function selectedAiBrandLabel() {
    if (fields.brand.value === "삼성전자") return "삼성전자";
    return "LG전자";
  }

  async function loadCatalogByBrand(brand) {
    if (state.catalogs[brand]) return state.catalogs[brand];
    const path = brand === "삼성전자" ? "/assets/samsung-catalog-product-model-map.json" : "/assets/pickquote-product-model-map.json";
    const response = await fetchWithTimeout(path, { cache: "no-store" }, 12000);
    if (!response.ok) throw new Error("catalog load failed");
    state.catalogs[brand] = await response.json();
    return state.catalogs[brand];
  }

  async function loadCatalog() {
    const brand = selectedBrandKey();
    if (!shouldUseAiRecommendation() || !["LG전자", "삼성전자"].includes(brand)) {
      throw new Error("비교견적에는 AI 추천을 사용하지 않습니다.");
    }
    return loadCatalogByBrand(brand);
  }

  async function loadModelLearning() {
    if (state.modelLearning) return state.modelLearning;
    try {
      const response = await fetchWithTimeout("/api/lplan-model-learning", { cache: "no-store" }, 9000);
      const data = response.ok ? await response.json() : null;
      state.modelLearning = data?.ok && data.modelCounts ? data.modelCounts : {};
      state.productLearning = data?.ok && data.productCounts ? data.productCounts : {};
    } catch {
      state.modelLearning = {};
      state.productLearning = {};
    }
    return state.modelLearning;
  }

  async function buildAiModelRecommendations() {
    const [catalog] = await Promise.all([loadCatalog(), loadModelLearning()]);
    const selectedProducts = state.selectedProducts.filter(Boolean);
    const totalWeight = selectedProducts.reduce((sum, product) => sum + productBudgetWeight(product), 0) || 1;
    const budgetWon = parseBudgetWon(state.aiContext.budgetRange);
    const groups = [];

    for (const product of selectedProducts) {
      const productKey = normalizeProductKey(product);
      const optionSource = optionStateFor(productKey);
      const optionBrand = optionBrandFor(optionSource);
      const models = Array.isArray(catalog?.[productKey]?.models) ? catalog[productKey].models : [];
      const brandModels = optionBrand ? models.filter((model) => modelMatchesOptionBrand(model, optionBrand)) : models;
      const candidates = filterModelsByProductOptions(product, brandModels);
      const targetPrice = budgetWon
        ? Math.round((budgetWon * productBudgetWeight(product)) / totalWeight)
        : defaultTargetPrice(product, candidates);

      const shortlist = rankModelCandidates(product, candidates, targetPrice).slice(0, 5);
      const enriched = await Promise.all(
        shortlist.map(async (model) => ({
          ...model,
          naverLowestPrice: (await fetchLowestPrice(model.modelName)) || 0,
        }))
      );

      const chosen = chooseRecommendedModel(product, enriched, targetPrice);
      const catalogModelNames = new Set(models.map((model) => compactModelName(model?.modelName || "")).filter(Boolean));
      const verifiedChosen =
        chosen &&
        catalogModelNames.has(compactModelName(chosen.modelName || "")) &&
        candidates.some((candidate) => compactModelName(candidate.modelName) === compactModelName(chosen.modelName))
          ? chosen
          : null;

      groups.push({
        product,
        displayProduct: productDisplayTitle(product, optionSource),
        optionSummary: productOptionSummary(product),
        targetPrice,
        models: verifiedChosen ? [verifiedChosen] : [{ modelName: "판매자 상담 후 모델 확정", normalPrice: 0, naverLowestPrice: 0 }],
      });
    }
    return groups;
  }

  function filterModelsByProductOptions(product, models) {
    const productKey = normalizeProductKey(product);
    const options = recommendationOptionState(productKey);
    const normalized = models
      .filter((model) => model && model.modelName)
      .filter((model) => isAllowedRecommendationModel(productKey, model))
      .map((model) => ({ ...model, normalPrice: Number(model.normalPrice || 0) }))
      .sort((a, b) => b.normalPrice - a.normalPrice);
    const optionText = Object.values(options)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean)
      .join(" ");
    const matchers = [];

    if (productKey === "TV") {
      if (options.type) {
        const selectedType = compactModelName(options.type);
        matchers.push((model) => {
          const body = modelBody(model);
          const text = compactModelName(modelSearchText(model));
          if (selectedType === "OLED") return /OLED/.test(body) || /OLED/.test(text);
          if (selectedType === "QNED") return /QNED/.test(body) || /QNED/.test(text);
          if (selectedType === "NEOQLED") return /^(KQ|QN)/.test(body) || /NEOQLED/.test(text);
          if (selectedType === "MRGB") return /MRGB|MICRORGB/.test(text) || /^(M|KQ).*RGB/.test(body);
          return text.includes(selectedType);
        });
      }

      if (options.size) {
        const selectedSize = Number(String(options.size).match(/\d+/)?.[0] || 0);
        const isOrAbove = /↑|이상|\+/.test(String(options.size));
        if (selectedSize) {
          matchers.push((model) => {
            const inches = extractTvInches(model.modelName);
            if (!inches) return false;
            return isOrAbove ? inches >= selectedSize : inches === selectedSize;
          });
        }
      }
    }

    if (productKey === "라이프스타일 TV") {
      matchers.push((model) => /스탠바이미|STANBYME|27ART|27LX|32LX|THEMOVINGSTYLE|LSH|SP-L/i.test(modelSearchText(model)));
      if (options.type) {
        const selectedType = compactModelName(options.type);
        matchers.push((model) => {
          const body = modelBody(model);
          const text = compactModelName(modelSearchText(model));
          if (/GO/.test(selectedType)) return /27LX5|STANBYMEGO|GO/.test(text);
          if (/스탠바이미/.test(String(options.type))) return !/27LX5|STANBYMEGO/.test(text);
          return true;
        });
      }
      if (options.size) {
        const selectedSize = Number(String(options.size).match(/\d+/)?.[0] || 0);
        if (selectedSize) matchers.push((model) => extractLifestyleTvInches(model.modelName) === selectedSize);
      }
    }

    if (productKey === "냉장고") {
      const wantsFitAndMax = /핏앤맥스|빌트인|FIT\s*&?\s*MAX/i.test(optionText);
      const wantsFreeStanding = /프리스탠딩|용량/i.test(optionText);
      const wantsIceWater = /얼음정수기/i.test(optionText);
      if (wantsFitAndMax) matchers.push((model) => isFitAndMaxFridgeModel(model));
      else if (wantsIceWater) matchers.push((model) => /^W\d{3}/.test(modelBody(model)) || /얼음정수기/i.test(modelSearchText(model)));
      else if (wantsFreeStanding) matchers.push((model) => isFreeStandingFridgeModel(model));
      if (/4도어/.test(optionText)) matchers.push((model) => isFourDoorFridgeModel(model));
      if (/2도어|양문형/.test(optionText)) matchers.push((model) => isTwoDoorFridgeModel(model));
    }

    if (productKey === "김치냉장고") {
      matchers.push((model) => isKimchiFridgeModel(model));
      if (/뚜껑식/.test(optionText)) matchers.push((model) => /뚜껑|K\d{3}|Z1/i.test(modelSearchText(model)));
      if (/스탠드|오브제/.test(optionText)) matchers.push((model) => /스탠드|Z\d{3}|RQ/i.test(modelSearchText(model)));
      if (/4도어/.test(optionText)) matchers.push((model) => /4도어|Z4|Z5|RQ5/i.test(modelSearchText(model)));
      if (/3도어/.test(optionText)) matchers.push((model) => /3도어|Z3|RQ3/i.test(modelSearchText(model)));
      if (/1도어/.test(optionText)) matchers.push((model) => /1도어|Z1|K\d{3}/i.test(modelSearchText(model)));
    }

    if (productKey === "세탁기/건조기" && optionText) {
      if (/분리형/.test(optionText)) matchers.push((model) => /(F\d{2}|RH|RD|세탁|건조)/i.test(modelSearchText(model)) && !/워시타워|원바디|콤보/i.test(modelSearchText(model)));
      if (/콤보/.test(optionText)) matchers.push((model) => /콤보|세탁건조|FX|FH/i.test(modelSearchText(model)) && !/^TR/i.test(modelBody(model)));
      if (/일체형|원바디|워시타워/.test(optionText)) matchers.push((model) => /워시타워|원바디|W\d{2}|WL|WK/i.test(modelSearchText(model)));
    }

    if (productKey === "청소기" && options.type) {
      const selectedTypes = Array.isArray(options.type) ? options.type : [options.type];
      matchers.push((model) =>
        selectedTypes.some((type) => {
          const selectedType = String(type || "");
          const text = modelSearchText(model);
          const body = modelBody(model);
          if (/로봇/.test(selectedType)) return /로봇청소기|ROBOT/i.test(text) || /^(MO|B9|R9|VR)/i.test(body);
          if (/무선/.test(selectedType)) {
            const isRobot = /로봇청소기|ROBOT/i.test(text) || /^(MO|B9|R9|VR)/i.test(body);
            return !isRobot && (/무선|코드제로|제트/i.test(text) || /^(AS|A7|AI9|A9|AU|VS)/i.test(body));
          }
          if (/유선/.test(selectedType)) return /유선/i.test(text) || /^VC/i.test(body);
          return text.replace(/\s+/g, "").includes(selectedType.replace(/\s*청소기/g, "").replace(/\s+/g, ""));
        })
      );
    }
    if (productKey === "에어컨" && optionText) {
      if (/천장형/.test(optionText)) matchers.push((model) => /천장|시스템/i.test(modelSearchText(model)));
      if (/2IN1/.test(optionText)) matchers.push((model) => /2IN1|2in1|투인원|멀티|FQ.*2/i.test(modelSearchText(model)));
      if (/스탠드/.test(optionText)) matchers.push((model) => /스탠드|FQ/i.test(modelSearchText(model)));
      if (/벽걸이/.test(optionText)) matchers.push((model) => /벽걸이|SQ|SW/i.test(modelSearchText(model)));
    }
    if (productKey === "식기세척기") matchers.push((model) => /식기|식세|D[FBE]/i.test(modelSearchText(model)));
    if (productKey === "인덕션/전기레인지") matchers.push((model) => /인덕션|전기레인지|하이라이트|BE|CB/i.test(modelSearchText(model)));
    if (productKey === "오븐 / 전자레인지" || productKey === "오븐/전자레인지") matchers.push((model) => /오븐|전자레인지|ML|MW/i.test(modelSearchText(model)));
    if (productKey === "공기청정기") matchers.push((model) => /공기|퓨리|청정|AS/i.test(modelSearchText(model)));
    if (productKey === "의류관리기") matchers.push((model) => /스타일러|의류|SC|S5|S3|DF/i.test(modelSearchText(model)));

    const matched = matchers.length
      ? normalized.filter((model) => matchers.every((matcher) => matcher(model)))
      : normalized;

    if (selectedBrandKey() === "LG전자" && ["냉장고", "김치냉장고"].includes(productKey)) {
      const gbbModels = matched.filter((model) => isGbbPreferredModel(model));
      if (gbbModels.length) return gbbModels;
    }

    return matched;
  }

  function isAllowedRecommendationModel(product, model) {
    const productKey = normalizeProductKey(product);
    const body = modelBody(model);
    const name = compactModelName(model?.modelName || "");
    const text = compactModelName(modelSearchText(model));
    const brand = compactModelName(model?.brand || "");

    if (!body || body.includes("상담")) return false;

    if (brand.includes("삼성") || brand.includes("SAMSUNG")) {
      return isAllowedSamsungRecommendationModel(product, model);
    }

    if (productKey === "라이프스타일 TV") {
      return /^(27ART|27LX|32LX|LSH|SP-L)/.test(body) || /STANBYME|스탠바이미|THEMOVINGSTYLE/.test(text);
    }

    if (productKey === "냉장고") {
      const optionText = Object.values(recommendationOptionState(productKey))
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(Boolean)
        .join(" ");
      const wantsFitAndMax = /빌트인|핏앤맥스|FIT\s*&?\s*MAX/i.test(optionText);
      const wantsFreeStanding = /프리스탠딩|용량/i.test(optionText);

      if (wantsFitAndMax) return isFitAndMaxFridgeModel(model);
      if (wantsFreeStanding && /^D646/.test(body)) return false;
      if (/^(B18|B182|A202|RT|RB)/.test(body)) return false;
    }

    if (productKey === "김치냉장고") {
      if (!isKimchiFridgeModel(model)) return false;
      if (/^(Z|K|RQ)/.test(body)) return true;
      return /김치|GBB/.test(text);
    }

    if (productKey === "청소기") {
      return /청소기/.test(text) && /^(AS|A7|AI9|MO|B9|A9|AU|R9|VS|VR|VC)/.test(body);
    }

    return true;
  }

  function isAllowedSamsungRecommendationModel(product, model) {
    const productKey = normalizeProductKey(product);
    const body = modelBody(model);
    const text = compactModelName(modelSearchText(model));

    if (!body || /^KMR/.test(body)) return false;

    if (productKey === "TV") return /^(KQ|KU|UN|QN|QA)\d{2,3}/.test(body);
    if (productKey === "라이프스타일 TV") return /^(KQ\d{2}LS|LSH|SP-L)/.test(body);
    if (productKey === "냉장고") return /^(RF|RM|RR|RS|RB)\d{2}/.test(body) || /BESPOKE/.test(text);
    if (productKey === "김치냉장고") return /^(RQ|RK)\d{2}/.test(body);
    if (productKey === "세탁기/건조기") return /^(WF|DV|WD|WR|WW)\d{2}/.test(body);
    if (productKey === "의류관리기") return /^DF\d{2}/.test(body);
    if (productKey === "에어컨") return /^(AF|AR|AP|AC)\d{2}/.test(body);
    if (productKey === "청소기") return /^(VS|VR|VC)\d{2}/.test(body);
    if (productKey === "식기세척기") return /^DW\d{2}/.test(body);
    if (productKey === "공기청정기") return /^AX\d{2}/.test(body);
    if (productKey === "인덕션/전기레인지") return /^(NZ|NZI|NZP|CTR)\d*/.test(body);
    if (productKey === "오븐 / 전자레인지" || productKey === "오븐/전자레인지") return /^(MC|MS|MG|MO|NQ)\d*/.test(body);

    return true;
  }

  function modelSearchText(model) {
    return [model?.modelName, model?.productGroup, model?.category, model?.title].filter(Boolean).join(" ");
  }

  function recommendationOptionState(product) {
    const source = optionStateFor(product);
    return Object.fromEntries(Object.entries(source).filter(([key]) => key !== "optionBrand"));
  }

  function modelMatchesOptionBrand(model, brand) {
    const modelBrand = compactModelName(model?.brand || "");
    if (!modelBrand) return true;
    if (brand === "삼성전자") return modelBrand.includes("삼성") || modelBrand.includes("SAMSUNG");
    if (brand === "LG전자") return modelBrand.includes("LG");
    return true;
  }

  function compactModelName(value) {
    return String(value || "").toUpperCase().replace(/\s+/g, "");
  }

  function modelBody(value) {
    const source = typeof value === "object" ? value?.modelName : value;
    return compactModelName(source).split(".")[0];
  }

  function isGbbPreferredModel(value) {
    return /GBB/i.test(compactModelName(modelSearchText(value)));
  }

  function isFitAndMaxFridgeModel(value) {
    const body = modelBody(value);
    const text = compactModelName(modelSearchText(value));
    if (/^(M876|W\d{3}|D\d{3}|B18|B182|A202|T87|T80|RT|RB)/.test(body)) return false;
    return /^G646/.test(body) || /^M623/.test(body) || /FITANDMAX|핏앤맥스/.test(text);
  }

  function isBuiltInFridgeModel(value) {
    return isFitAndMaxFridgeModel(value);
  }

  function isFreeStandingFridgeModel(value) {
    const body = modelBody(value);
    const text = modelSearchText(value);
    if (isFitAndMaxFridgeModel(value)) return false;
    return /프리스탠딩|스탠드|용량/i.test(text) || /^(M87|M86|W82|T87|T80)/.test(body);
  }

  function isFourDoorFridgeModel(value) {
    const body = modelBody(value);
    const text = compactModelName(modelSearchText(value));
    if (/^(B18|B182|A202|RT|RB|D\d{3})/.test(body)) return false;
    return /4도어|노크온|상냉장|매직스페이스/.test(modelSearchText(value)) || /^(G646|M623|M87|M86|W82|T87|RF)\d*/.test(body) || /BESPOKE/.test(text);
  }

  function isTwoDoorFridgeModel(value) {
    const body = modelBody(value);
    return /2도어|양문형|일반냉장고/i.test(modelSearchText(value)) || /^(B18|B182|D\d{3}|RS|RT|RB)/.test(body);
  }

  function isKimchiFridgeModel(value) {
    const body = modelBody(value);
    const text = modelSearchText(value);
    return /김치|Z\d{3}|K\d{3}|RQ/i.test(text) || /^(Z|K|RQ)\d{2,3}/.test(body);
  }

  function productBudgetWeight(product) {
    return {
      TV: 1.45,
      "라이프스타일 TV": 0.7,
      냉장고: 1.25,
      김치냉장고: 0.95,
      "세탁기/건조기": 1.35,
      의류관리기: 0.75,
      에어컨: 1.25,
      청소기: 0.45,
      식기세척기: 0.55,
      공기청정기: 0.4,
      "인덕션/전기레인지": 0.55,
      "오븐/전자레인지": 0.35,
    }[product] || 0.8;
  }

  function parseBudgetWon(value) {
    const source = String(value || "").replace(/,/g, "").trim();
    if (!source) return 0;
    const numbers = [...source.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])).filter(Boolean);
    if (!numbers.length) return 0;
    const number = Math.max(...numbers);
    if (/억/.test(source)) return Math.round(number * 100000000);
    if (/만원|만/.test(source) || number < 100000) return Math.round(number * 10000);
    return Math.round(number);
  }

  function defaultTargetPrice(product, candidates) {
    const prices = candidates
      .map((model) => estimatedOnlinePrice(model))
      .filter((price) => price >= 300000)
      .sort((a, b) => a - b);
    if (!prices.length) return productBudgetWeight(product) * 1800000;
    const indexRatio = isPremiumAiContext() ? 0.72 : 0.56;
    return prices[Math.min(prices.length - 1, Math.floor(prices.length * indexRatio))];
  }

  function isPremiumAiContext() {
    const text = [state.aiContext.situation, state.aiContext.budgetRange, ...state.aiContext.priorities, state.aiContext.note].join(" ");
    return /혼수|웨딩|신축|입주|프리미엄|하이엔드|오브제|핏앤맥스/i.test(text);
  }

  function estimatedOnlinePrice(model) {
    const normalPrice = Number(model?.normalPrice || 0);
    if (normalPrice < 300000) return 0;
    return Math.round(normalPrice * 0.62);
  }

  function rankModelCandidates(product, candidates, targetPrice) {
    const premium = isPremiumAiContext();
    return [...candidates].sort((a, b) => modelPreScore(product, a, targetPrice, premium) - modelPreScore(product, b, targetPrice, premium));
  }

  function modelPreScore(product, model, targetPrice, premium) {
    const price = estimatedOnlinePrice(model) || Number(model.normalPrice || 0) || targetPrice || 1;
    const target = targetPrice || price || 1;
    let score = Math.abs(price - target) / target;
    if (premium && price < target * 0.72) score += 0.9;
    if (!premium && price < target * 0.5) score += 0.35;
    if (price > target * 1.65) score += 0.25;
    return score + modelQualityAdjustment(product, model);
  }

  function chooseRecommendedModel(product, candidates, targetPrice) {
    const premium = isPremiumAiContext();
    const allowed = [...candidates]
      .filter((model) => model && model.modelName)
      .filter((model) => isAllowedRecommendationModel(product, model));
    const priced = allowed.filter((model) => Number(model.naverLowestPrice || 0) >= 300000);
    return (priced.length ? priced : allowed)
      .sort((a, b) => {
        const aNaverPrice = Number(a.naverLowestPrice || 0);
        const bNaverPrice = Number(b.naverLowestPrice || 0);
        const aPrice = aNaverPrice >= 300000 ? aNaverPrice : estimatedOnlinePrice(a);
        const bPrice = bNaverPrice >= 300000 ? bNaverPrice : estimatedOnlinePrice(b);
        const target = targetPrice || Math.max(aPrice, bPrice, 1);
        let aScore = Math.abs(aPrice - target) / target;
        let bScore = Math.abs(bPrice - target) / target;
        if (premium && aPrice < target * 0.72) aScore += 0.95;
        if (premium && bPrice < target * 0.72) bScore += 0.95;
        if (!premium && aPrice < target * 0.5) aScore += 0.35;
        if (!premium && bPrice < target * 0.5) bScore += 0.35;
        if (aPrice > target * 1.65) aScore += 0.2;
        if (bPrice > target * 1.65) bScore += 0.2;
        if (a.catalogueHit) aScore -= 0.08;
        if (b.catalogueHit) bScore -= 0.08;
        return aScore + modelQualityAdjustment(product, a) - (bScore + modelQualityAdjustment(product, b));
      })[0];
  }

  function modelQualityAdjustment(product, model) {
    const productKey = normalizeProductKey(product);
    const name = String(typeof model === "object" ? model?.modelName : model || "").toUpperCase();
    const text = compactModelName(modelSearchText(typeof model === "object" ? model : { modelName: name }));
    const body = modelBody(model);
    const brand = typeof model === "object" ? model?.brand || "" : "";
    let score = 0;
    const learnedCount = modelLearningCount(model);
    if (learnedCount > 0) score -= Math.min(0.3, Math.log2(learnedCount + 1) * 0.06);
    const productCount = productLearningCount(productKey);
    if (productCount > 0) score -= Math.min(0.12, Math.log2(productCount + 1) * 0.025);
    if (productKey === "TV") {
      if (/OLED|QNED9|QNED8/.test(name)) score -= 0.22;
      if (/^(KQ|QN).*9|OLED|NEO/.test(name) || /NEO QLED|OLED/.test(text)) score -= 0.18;
      if (/QNED70|NANO70/.test(name)) score += 0.3;
      if (/^KU/.test(name)) score += 0.22;
    }
    if (productKey === "냉장고") {
      if (isGbbPreferredModel(model)) score -= 0.85;
      if (/^G646|^M623/.test(body)) score -= 0.7;
      if (/^M876|^W\d{3}|^D\d{3}|^T87|^T80/.test(body)) score += 0.55;
      if (/B18|B182|A202|^RT|^RB/.test(name)) score += 0.65;
    }
    if (productKey === "세탁기/건조기") {
      if (/FX|FH|W2|WL|WK/.test(name)) score -= 0.18;
      if (/WD|WR|BESPOKE|콤보/.test(text)) score -= 0.16;
      if (/TR16|RH9|단품/.test(name)) score += 0.4;
    }
    if (productKey === "김치냉장고") {
      if (isGbbPreferredModel(model)) score -= 0.85;
      if (/^Z|^K|^RQ/.test(body)) score -= 0.2;
      if (/BROWN|WHITE|SILVER/i.test(text)) score += 0.18;
    }
    if (productKey === "청소기" && /B95|B94|A9/.test(name)) score -= 0.12;
    if (productKey === "청소기" && /^VS/.test(name)) score -= 0.1;
    if (productKey === "의류관리기" && /SC5|S5/.test(name)) score -= 0.12;
    if (productKey === "의류관리기" && /^DF/.test(name)) score -= 0.12;
    if (brand === "삼성전자" && fields.brand.value === "삼성전자") score -= 0.03;
    return score;
  }

  function modelLearningCount(model) {
    const counts = state.modelLearning || {};
    const fullName = compactModelName(typeof model === "object" ? model?.modelName : model);
    const body = modelBody(model);
    const exactCount = Number(counts[fullName] || 0);
    if (!body) return exactCount;
    const bodyCount = Object.entries(counts).reduce((sum, [name, value]) => {
      return String(name).split(".")[0] === body ? sum + Number(value || 0) : sum;
    }, 0);
    return Math.max(exactCount, bodyCount);
  }

  function productLearningCount(product) {
    const counts = state.productLearning || {};
    const target = compactModelName(product);
    return Object.entries(counts).reduce((max, [name, value]) => {
      const normalized = compactModelName(name);
      return normalized === target || normalized.includes(target) || target.includes(normalized)
        ? Math.max(max, Number(value || 0))
        : max;
    }, 0);
  }

  function extractTvInches(modelName) {
    const name = String(modelName || "").toUpperCase().replace(/\s+/g, "");
    const patterns = [
      /OLED(\d{2,3})/,
      /(?:KQ|KU|QN|QA|UN|TQ|LH|KMR|MNA)(\d{2,3})/,
      /^(\d{2,3})(?:QNED|NANO)/,
      /(^|[^A-Z0-9])(\d{2,3})(?:QNED|NANO)/,
    ];

    for (const pattern of patterns) {
      const match = name.match(pattern);
      const raw = match?.[2] || match?.[1];
      const inches = Number(raw || 0);
      if (inches >= 20 && inches <= 120) return inches;
    }
    return 0;
  }

  function extractLifestyleTvInches(modelName) {
    const name = compactModelName(modelName);
    const match = name.match(/^(27|32)(?:ART|LX|LSH|SP-L)/);
    if (match) return Number(match[1]);
    return extractTvInches(name);
  }

  async function fetchLowestPrice(modelName) {
    const cacheKey = modelBody(modelName);
    if (!cacheKey) return 0;
    if (state.lowestPriceCache.has(cacheKey)) return state.lowestPriceCache.get(cacheKey);

    const request = (async () => {
      try {
        const response = await fetchWithTimeout(
          `/api/naver-shopping-lowest?query=${encodeURIComponent(cacheKey)}&display=30`,
          { cache: "no-store" },
          12000
        );
        if (!response.ok) return 0;
        const data = await response.json();
        if (!data.ok || data.confidence !== "exact-model-filtered") return 0;
        return Number(data.lowestPrice || 0);
      } catch {
        return 0;
      }
    })();

    state.lowestPriceCache.set(cacheKey, request);
    return request;
  }

  function recommendationsToText(groups) {
    const lines = ["고객의 상황에 맞춰 AI가 추천한 모델임을 알려드립니다."];
    groups.forEach((group) => {
      lines.push("");
      lines.push(
        `[${group.displayProduct || group.product}]${group.optionSummary ? ` ${group.optionSummary}` : ""}`
      );
      group.models.forEach((model) => lines.push(`- ${displayModelName(model)}${formatModelLowestPrice(model)}`));
    });
    const total = recommendationTotalPrice(groups);
    if (total > 0) {
      lines.push("");
      lines.push(`네이버 최저가 기준 합계: ${formatWon(total)}`);
    }
    return lines.join("\n").trim();
  }

  function displayModelName(model) {
    return model?.modelName || "판매자 상담 후 모델 확정";
  }

  function formatWon(value) {
    const price = Number(value || 0);
    return price > 0 ? `${price.toLocaleString("ko-KR")}원` : "";
  }

  function formatModelLowestPrice(model) {
    const price = Number(model?.naverLowestPrice || 0);
    return price >= 300000 ? ` (네이버 최저가 ${formatWon(price)})` : "";
  }

  function renderModelWithPrice(model) {
    const price = Number(model?.naverLowestPrice || 0);
    const priceLabel = price >= 300000 ? `네이버 최저가 ${formatWon(price)}` : "일반 구매가 확인 중";
    return `<span>${escapeHtml(displayModelName(model))}</span><em>${escapeHtml(priceLabel)}</em>`;
  }

  function recommendationModelPrice(model) {
    const naverPrice = Number(model?.naverLowestPrice || 0);
    return naverPrice >= 300000 ? naverPrice : 0;
  }

  function recommendationTotalPrice(groups) {
    return groups.reduce((sum, group) => {
      const productTotal = (group.models || []).reduce((modelSum, model) => modelSum + recommendationModelPrice(model), 0);
      return sum + productTotal;
    }, 0);
  }

  function renderRecommendationTotal(groups) {
    const total = recommendationTotalPrice(groups);
    if (!total) return "";
    return `
      <div class="ai-recommendation-total">
        <span>네이버 최저가 기준 합계</span>
        <strong>${escapeHtml(formatWon(total))}</strong>
      </div>
    `;
  }

  function fallbackRecommendationText() {
    const lines = ["고객의 상황에 맞춰 AI가 추천한 모델임을 알려드립니다."];
    state.selectedProducts.forEach((product) => {
      lines.push("");
      lines.push(`[${product}]${productOptionSummary(product) ? ` ${productOptionSummary(product)}` : ""}`);
      lines.push("- 판매자 상담 후 모델 확정");
    });
    return lines.join("\n").trim();
  }

  function applyAutoLowestPrice(groups) {
    const total = recommendationTotalPrice(groups);
    fields.price.value = total ? String(Math.ceil(total / 10000)) : "0";
  }

  function updatePreview() {
    if (previewTitle) previewTitle.textContent = buildItemsValue() || "견적 요청서가 여기에 표시됩니다.";
    if (previewMeta) {
      const brand = fields.brand.value || "브랜드 미선택";
      const region = fields.region.value || "지역 미입력";
      const type = isWithoutQuote() ? "견적서 없음" : isWithQuote() ? "견적서 있음" : "견적서 유무 미선택";
      previewMeta.textContent = `${type} · ${brand} · ${region}`;
    }
    if (imagePreview && isWithoutQuote()) {
      imagePreview.innerHTML = isComparisonWithoutQuote()
        ? "<span>견적서 없이 선택 품목·옵션과 예산으로 비교 요청됩니다.</span>"
        : "<span>견적서 없이 AI 추천 정보로 접수됩니다.</span>";
    }
  }

  function formatPhoneInput(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.startsWith("02")) {
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
      return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    }
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
