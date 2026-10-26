import type {
  Child,
  DashboardSummary,
  Group,
  ParentProfile,
  TeacherProfile,
  User,
} from "@/types";

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_USER: User = {
  id: 1,
  name: "Yulduz bog'chasi",
  phone: "+998901234567",
  email: "demo@kiddo.uz",
  role: "admin",
  organization_id: 1,
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
};

export const DEMO_GROUPS: Group[] = [
  {
    id: 1,
    organization_id: 1,
    name: "Kamalak guruhi",
    age_category: "3–4 yosh",
    capacity: 20,
    is_active: true,
    children_count: 14,
    teacher_profiles_count: 2,
  },
  {
    id: 2,
    organization_id: 1,
    name: "Nilufar guruhi",
    age_category: "4–5 yosh",
    capacity: 18,
    is_active: true,
    children_count: 16,
    teacher_profiles_count: 1,
  },
  {
    id: 3,
    organization_id: 1,
    name: "Bahor guruhi",
    age_category: "5–6 yosh",
    capacity: 15,
    is_active: true,
    children_count: 9,
    teacher_profiles_count: 1,
  },
  {
    id: 4,
    organization_id: 1,
    name: "Quyosh guruhi",
    age_category: "2–3 yosh",
    capacity: 12,
    is_active: true,
    children_count: 7,
    teacher_profiles_count: 1,
  },
];

export const DEMO_SUMMARY: DashboardSummary = {
  bolalar_soni:      46,
  guruhlar_soni:     4,
  tarbiyachilar_soni: 5,
  ota_onalar_soni:   38,
};

export const DEMO_CHILDREN: Child[] = [
  { id: 1,  organization_id: 1, group_id: 1, first_name: "Azizbek",  last_name: "Karimov",     birth_date: "2021-03-15", gender: "erkak", is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 2,  organization_id: 1, group_id: 1, first_name: "Malika",   last_name: "Yusupova",    birth_date: "2021-07-22", gender: "ayol",  is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 3,  organization_id: 1, group_id: 1, first_name: "Sardor",   last_name: "Toshmatov",   birth_date: "2021-01-10", gender: "erkak", is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 4,  organization_id: 1, group_id: 1, first_name: "Shahlo",   last_name: "Normatova",   birth_date: "2021-09-03", gender: "ayol",  is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 5,  organization_id: 1, group_id: 2, first_name: "Gulnora",  last_name: "Ergasheva",   birth_date: "2020-05-30", gender: "ayol",  is_active: true,  group: { id: 2, name: "Nilufar guruhi" } },
  { id: 6,  organization_id: 1, group_id: 2, first_name: "Jasur",    last_name: "Nazarov",     birth_date: "2020-09-14", gender: "erkak", is_active: true,  group: { id: 2, name: "Nilufar guruhi" } },
  { id: 7,  organization_id: 1, group_id: 2, first_name: "Zulfiya",  last_name: "Mirzayeva",   birth_date: "2020-11-08", gender: "ayol",  is_active: true,  group: { id: 2, name: "Nilufar guruhi" } },
  { id: 8,  organization_id: 1, group_id: 2, first_name: "Otabek",   last_name: "Holiqov",     birth_date: "2020-03-27", gender: "erkak", is_active: false, group: { id: 2, name: "Nilufar guruhi" } },
  { id: 9,  organization_id: 1, group_id: 3, first_name: "Bobur",    last_name: "Xasanov",     birth_date: "2019-04-12", gender: "erkak", is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 10, organization_id: 1, group_id: 3, first_name: "Nilufar",  last_name: "Raximova",    birth_date: "2019-08-25", gender: "ayol",  is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 11, organization_id: 1, group_id: 3, first_name: "Firdavs",  last_name: "Usmonov",     birth_date: "2019-02-18", gender: "erkak", is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 12, organization_id: 1, group_id: 3, first_name: "Iroda",    last_name: "Sultonova",   birth_date: "2019-12-01", gender: "ayol",  is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 13, organization_id: 1, group_id: 4, first_name: "Lobar",    last_name: "Abdullayeva", birth_date: "2022-06-05", gender: "ayol",  is_active: true,  group: { id: 4, name: "Quyosh guruhi" } },
  { id: 14, organization_id: 1, group_id: 4, first_name: "Sherzod",  last_name: "Qodirov",     birth_date: "2022-01-17", gender: "erkak", is_active: true,  group: { id: 4, name: "Quyosh guruhi" } },
  { id: 15, organization_id: 1, group_id: null, first_name: "Kamol", last_name: "Hamidov",     birth_date: "2020-07-19", gender: "erkak", is_active: true,  group: null },
];

export const DEMO_TEACHERS: TeacherProfile[] = [
  {
    id: 1,
    user_id: 10,
    organization_id: 1,
    first_name: "Maftuna",
    last_name:  "Xolmatova",
    phone:      "+998901234001",
    position:   "Bosh tarbiyachi",
    is_active:  true,
    groups:     [{ id: 1, name: "Kamalak guruhi" }, { id: 2, name: "Nilufar guruhi" }],
  },
  {
    id: 2,
    user_id: 11,
    organization_id: 1,
    first_name: "Dilnoza",
    last_name:  "Tursunova",
    phone:      "+998901234002",
    position:   "Tarbiyachi",
    is_active:  true,
    groups:     [{ id: 1, name: "Kamalak guruhi" }],
  },
  {
    id: 3,
    user_id: 12,
    organization_id: 1,
    first_name: "Sarvinoz",
    last_name:  "Qosimova",
    phone:      "+998901234003",
    position:   "Tarbiyachi",
    is_active:  true,
    groups:     [{ id: 3, name: "Bahor guruhi" }],
  },
  {
    id: 4,
    user_id: 13,
    organization_id: 1,
    first_name: "Kamola",
    last_name:  "Nazarova",
    phone:      "+998901234004",
    position:   "Tarbiyachi",
    is_active:  true,
    groups:     [{ id: 4, name: "Quyosh guruhi" }],
  },
  {
    id: 5,
    user_id: 14,
    organization_id: 1,
    first_name: "Nodira",
    last_name:  "Rustamova",
    phone:      "+998901234005",
    position:   "Yordamchi tarbiyachi",
    is_active:  false,
    groups:     [],
  },
];

export const DEMO_PARENTS: ParentProfile[] = [
  {
    id: 1,
    user_id: 20,
    organization_id: 1,
    first_name: "Baxtiyor",
    last_name:  "Karimov",
    phone:      "+998901234101",
    children:   [{ id: 1, first_name: "Azizbek", last_name: "Karimov" }],
  },
  {
    id: 2,
    user_id: 21,
    organization_id: 1,
    first_name: "Mohira",
    last_name:  "Yusupova",
    phone:      "+998901234102",
    children:   [{ id: 2, first_name: "Malika", last_name: "Yusupova" }],
  },
  {
    id: 3,
    user_id: 22,
    organization_id: 1,
    first_name: "Sarvarbek",
    last_name:  "Toshmatov",
    phone:      "+998901234103",
    children:   [{ id: 3, first_name: "Sardor", last_name: "Toshmatov" }],
  },
  {
    id: 4,
    user_id: null,
    organization_id: 1,
    first_name: "Muazzam",
    last_name:  "Ergasheva",
    phone:      "+998901234104",
    children:   [{ id: 5, first_name: "Gulnora", last_name: "Ergasheva" }],
  },
  {
    id: 5,
    user_id: 23,
    organization_id: 1,
    first_name: "Dostonbek",
    last_name:  "Nazarov",
    phone:      "+998901234105",
    children:   [{ id: 6, first_name: "Jasur", last_name: "Nazarov" }],
  },
  {
    id: 6,
    user_id: null,
    organization_id: 1,
    first_name: "Hamid",
    last_name:  "Mirzayev",
    phone:      "+998901234106",
    children:   [{ id: 7, first_name: "Zulfiya", last_name: "Mirzayeva" }],
  },
  {
    id: 7,
    user_id: 24,
    organization_id: 1,
    first_name: "Ulugbek",
    last_name:  "Xasanov",
    phone:      "+998901234107",
    children:   [{ id: 9, first_name: "Bobur", last_name: "Xasanov" }],
  },
  {
    id: 8,
    user_id: null,
    organization_id: 1,
    first_name: "Nargiza",
    last_name:  "Raximova",
    phone:      "+998901234108",
    children:   [
      { id: 10, first_name: "Nilufar",  last_name: "Raximova" },
      { id: 11, first_name: "Firdavs",  last_name: "Usmonov"  },
    ],
  },
];

type RequestOptions = { method?: string };

export function handleDemoRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  return new Promise<T>((resolve) => {
    setTimeout(() => {
      // Write operations succeed silently — modals close, pages reload same demo data
      if (method !== "GET") {
        resolve(undefined as T);
        return;
      }

      if (path === "/v1/me") {
        resolve({ user: DEMO_USER } as T);
      } else if (path.startsWith("/v1/admin/dashboard")) {
        resolve(DEMO_SUMMARY as T);
      } else if (path.startsWith("/v1/admin/groups")) {
        resolve({ data: DEMO_GROUPS } as T);
      } else if (path.startsWith("/v1/admin/children")) {
        resolve({ data: DEMO_CHILDREN } as T);
      } else if (path.startsWith("/v1/admin/teachers")) {
        resolve({ data: DEMO_TEACHERS } as T);
      } else if (path.startsWith("/v1/admin/parents")) {
        resolve({ data: DEMO_PARENTS } as T);
      } else {
        resolve(undefined as T);
      }
    }, 280);
  });
}
