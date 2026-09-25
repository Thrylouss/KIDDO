/**
 * O'zbek tili lug'ati — barcha UI matnlari shu yerda.
 * Keyinchalik rus/ingliz tillarini qo'shish uchun shu strukturadan foydalaning.
 */
const uz = {
  // Umumiy
  common: {
    yuklanmoqda: "Yuklanmoqda...",
    xato: "Xatolik yuz berdi",
    saqlash: "Saqlash",
    bekor_qilish: "Bekor qilish",
    tahrirlash: "Tahrirlash",
    ochirish: "O'chirish",
    qoshish: "Qo'shish",
    izlash: "Izlash",
    filtrlash: "Filtrlash",
    HA: "Ha",
    YOQ: "Yo'q",
    orqaga: "Orqaga",
    davom_etish: "Davom etish",
    tasdiqlash: "Tasdiqlash",
    yopish: "Yopish",
    malumot_yoq: "Ma'lumot topilmadi",
  },

  // Autentifikatsiya
  auth: {
    kirish: "Tizimga kirish",
    chiqish: "Chiqish",
    telefon: "Telefon raqam",
    email: "Elektron pochta",
    parol: "Parol",
    parolni_tasdiqlash: "Parolni tasdiqlang",
    kirish_btn: "Kirish",
    xato_kirish: "Telefon yoki parol noto'g'ri",
    xush_kelibsiz: "Xush kelibsiz, KIDDO!",
  },

  // Dashboard
  dashboard: {
    sarlavha: "Boshqaruv paneli",
    bolalar: "Bolalar",
    guruhlar: "Guruhlar",
    tarbiyachilar: "Tarbiyachilar",
    bugungi_davomat: "Bugungi davomat",
    keldi: "Keldi",
    kelmadi: "Kelmadi",
  },

  // Bog'cha
  bogcha: {
    sarlavha: "Bog'cha",
    nomi: "Bog'cha nomi",
    manzil: "Manzil",
    telefon: "Telefon",
    qoshish: "Bog'cha qo'shish",
    tahrirlash: "Bog'chani tahrirlash",
    ochirish_tasdiqi: "Bu bog'chani o'chirishni tasdiqlaysizmi?",
  },

  // Guruhlar
  guruhlar: {
    sarlavha: "Guruhlar",
    nomi: "Guruh nomi",
    yosh_oralighi: "Yosh oralig'i",
    tarbiyachi: "Tarbiyachi",
    bolalar_soni: "Bolalar soni",
    qoshish: "Guruh qo'shish",
    ochirish_tasdiqi: "Bu guruhni o'chirishni tasdiqlaysizmi?",
  },

  // Bolalar
  bolalar: {
    sarlavha: "Bolalar",
    ismi: "Ismi",
    familiyasi: "Familiyasi",
    tug_sanasi: "Tug'ilgan sana",
    jinsi: "Jinsi",
    jins_erkak: "O'g'il",
    jins_qiz: "Qiz",
    guruh: "Guruh",
    qoshish: "Bola qo'shish",
    ochirish_tasdiqi: "Bu bolani ro'yxatdan o'chirishni tasdiqlaysizmi?",
  },

  // Ota-onalar
  ota_onalar: {
    sarlavha: "Ota-onalar",
    ismi: "Ismi",
    telefon: "Telefon",
    email: "Elektron pochta",
    bola: "Bola",
    qoshish: "Ota-ona qo'shish",
  },

  // Tarbiyachilar
  tarbiyachilar: {
    sarlavha: "Tarbiyachilar",
    ismi: "Ismi",
    telefon: "Telefon",
    guruh: "Guruh",
    qoshish: "Tarbiyachi qo'shish",
  },

  // Davomat
  davomat: {
    sarlavha: "Davomat",
    sana: "Sana",
    keldi: "Keldi",
    kelmadi: "Kelmadi",
    sababli: "Sababli",
    saqlash: "Davomatni saqlash",
    guruh_tanlang: "Guruh tanlang",
  },

  // Kunlik faoliyat
  faoliyat: {
    sarlavha: "Kunlik faoliyat",
    turi: "Faoliyat turi",
    tavsif: "Tavsif",
    vaqt: "Vaqt",
    qoshish: "Faoliyat qo'shish",
  },

  // Ovqatlanish
  ovqat: {
    sarlavha: "Ovqatlanish",
    nonushta: "Nonushta",
    tushlik: "Tushlik",
    kechki_ovqat: "Kechki ovqat",
    eydi: "Yedi",
    yemadi: "Yemadi",
    qisman: "Qisman",
  },

  // Uyqu
  uyqu: {
    sarlavha: "Uyqu",
    boshlandi: "Uyqu boshlandi",
    tugadi: "Uyqu tugadi",
    davomiyligi: "Davomiyligi",
    daqiqa: "daqiqa",
  },

  // Rasmlar
  rasmlar: {
    sarlavha: "Rasmlar",
    yuklash: "Rasm yuklash",
    guruh_tanlang: "Guruh tanlang",
    tavsif: "Tavsif",
  },

  // Xabarlar
  xabarlar: {
    sarlavha: "Xabarlar",
    yangi_xabar: "Yangi xabar",
    yuborish: "Yuborish",
    qabul_qiluvchi: "Qabul qiluvchi",
    matn: "Xabar matni",
    xabar_yoq: "Hali xabar yo'q",
  },

  // To'lov
  tolov: {
    sarlavha: "To'lov holati",
    oylik: "Oylik to'lov",
    tolovchi: "To'lovchi",
    summa: "Summa",
    tolangan: "To'langan",
    tolanmagan: "To'lanmagan",
    qisman_tolangan: "Qisman to'langan",
    oy: "Oy",
    sana: "To'lov sanasi",
  },

  // Xatolar
  xatolar: {
    majburiy: "Bu maydon majburiy",
    email_xato: "Elektron pochta noto\'g\'ri",
    parol_qisqa: "Parol kamida 8 ta belgidan iborat bo'lishi kerak",
    telefon_xato: "Telefon raqam noto\'g\'ri",
    server_xato: "Server xatosi. Qayta urinib ko'ring.",
    ruxsat_yoq: "Sizda bu amalni bajarish uchun ruxsat yo'q",
    topilmadi: "So'ralgan ma'lumot topilmadi",
  },
} as const;

export type UzTranslations = typeof uz;
export default uz;
