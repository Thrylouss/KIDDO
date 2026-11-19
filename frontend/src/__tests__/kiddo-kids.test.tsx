import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import OwnerPage from "@/app/bogcha/kiddo-kids/page";
import TeacherPage from "@/app/tarbiyachi/kiddo-kids/page";
import VideoPlayerModal from "@/components/kids/VideoPlayerModal";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";
import type { KidsContent } from "@/lib/kids";

const t = uz.kids;
let mockUser: { role: string } = { role: "admin" };

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

const VID = "dQw4w9WgXcQ";
const item = (over: Partial<KidsContent> = {}): KidsContent => ({
  id: 1, title: "Ranglar va shakllar", description: "Ranglarni o'rganamiz", youtube_video_id: VID,
  thumbnail_url: `https://i.ytimg.com/vi/${VID}/hqdefault.jpg`,
  embed_url: `https://www.youtube-nocookie.com/embed/${VID}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
  watch_url: `https://www.youtube.com/watch?v=${VID}`, duration_seconds: 185, embeddable: true,
  language: "uz", category: "lessons", min_age: 4, max_age: 5, status: "active",
  groups: [{ id: 2, name: "Quvnoqlar" }], usage_count: 3, is_favorite: false, ...over,
});
const groups = [
  { id: 1, name: "Kichkintoylar", age_category: "2-3 yosh", age_range: [2, 3] as [number, number] },
  { id: 2, name: "Quvnoqlar", age_category: "4-5 yosh", age_range: [4, 5] as [number, number] },
  { id: 3, name: "Quyoshchalar", age_category: "6-7 yosh", age_range: [6, 7] as [number, number] },
];
const page = (data: KidsContent[], extra = {}) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length, counts: {} }, groups, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { role: "admin" };
});

describe("KIDDO Kids — rahbar kutubxonasi", () => {
  it("kartochkalar: thumbnail, til, yosh, kategoriya, guruhlar, davomiylik, foydalanish soni", async () => {
    vi.mocked(api.get).mockResolvedValue(page([item()]));
    render(<OwnerPage />);
    const card = await screen.findByTestId("kids-card");
    expect(within(card).getByText("Ranglar va shakllar")).toBeInTheDocument();
    expect(within(card).getByText("UZ")).toBeInTheDocument();
    expect(within(card).getByText(`4–5 ${t.yosh_qisqa}`)).toBeInTheDocument();
    expect(within(card).getByText(t.kat.lessons)).toBeInTheDocument();
    expect(within(card).getByText("Quvnoqlar")).toBeInTheDocument();
    expect(within(card).getByText("3:05")).toBeInTheDocument();
    expect(within(card).getByText(new RegExp(`3 ${t.foydalanildi}`))).toBeInTheDocument();
    expect(card.querySelector("img")?.getAttribute("src")).toBe(`https://i.ytimg.com/vi/${VID}/hqdefault.jpg`);
    expect(vi.mocked(api.get).mock.calls[0][0]).toMatch(/^\/v1\/admin\/kids\/contents\?/);
  });

  it("til va kategoriya filtrlari API so'roviga uzatiladi", async () => {
    vi.mocked(api.get).mockResolvedValue(page([item()]));
    render(<OwnerPage />);
    await screen.findByTestId("kids-card");
    fireEvent.change(screen.getByLabelText(t.til), { target: { value: "ru" } });
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.at(-1)?.[0]).toContain("language=ru"));
    fireEvent.change(screen.getByLabelText(t.kategoriya), { target: { value: "music" } });
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.at(-1)?.[0]).toMatch(/language=ru.*category=music|category=music.*language=ru/));
  });

  it("yangi kontent: noto'g'ri URL rad etiladi, tekshirish tavsiyalarni to'ldiradi, mos kelmaydigan guruh tanlanmaydi", async () => {
    vi.mocked(api.get).mockResolvedValue(page([]));
    vi.mocked(api.post).mockImplementation(async (path: string) => {
      if (path.endsWith("/preview")) {
        return { video_id: VID, duplicate: false,
          metadata: { available: true, title: "Ranglar — bolalar uchun", author: "Kids TV", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg", embeddable: true, duration_seconds: null },
          suggestions: { language: "uz", category: "lessons", min_age: 4, max_age: 7, group_ids: [2, 3], confidence: "low" } };
      }
      return { data: item({ id: 9 }) };
    });
    render(<OwnerPage />);
    fireEvent.click(await screen.findByRole("button", { name: t.qoshish }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(new RegExp(t.f_url)), { target: { value: "https://vimeo.com/123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.f_tekshirish }));
    expect(await within(dialog).findByText(t.f_url_xato)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(new RegExp(t.f_url)), { target: { value: `https://youtu.be/${VID}` } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.f_tekshirish }));
    const preview = await within(dialog).findByTestId("kids-preview");
    expect(within(preview).getByText(t.tavsiya_izoh)).toBeInTheDocument();               // xavfsizlik kafolati yo'qligi haqida
    expect((within(dialog).getByLabelText(new RegExp(t.f_nomi)) as HTMLInputElement).value).toBe("Ranglar — bolalar uchun");

    const small = within(dialog).getByRole("checkbox", { name: /Kichkintoylar/ }) as HTMLInputElement;
    expect(small.disabled).toBe(true);                                                     // 2-3 yosh — 4-7 ga mos emas
    expect((within(dialog).getByRole("checkbox", { name: /Quvnoqlar/ }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(within(dialog).getByRole("button", { name: uz.common.saqlash }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/admin/kids/contents", expect.objectContaining({
      youtube_url: `https://youtu.be/${VID}`, title: "Ranglar — bolalar uchun", min_age: 4, max_age: 7, group_ids: [2, 3], status: "active", language: "uz",
    })));
    expect(await screen.findByRole("status")).toHaveTextContent(t.qoshildi);
  });

  it("yashirish va xavfsiz o'chirish (tasdiq bilan)", async () => {
    vi.mocked(api.get).mockResolvedValue(page([item()]));
    vi.mocked(api.patch).mockResolvedValue({ data: item({ status: "hidden" }) });
    vi.mocked(api.delete).mockResolvedValue({});
    render(<OwnerPage />);
    await screen.findByTestId("kids-card");

    fireEvent.click(screen.getByRole("button", { name: t.yashirish }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/v1/admin/kids/contents/1/status", { status: "hidden" }));
    expect(await screen.findByRole("button", { name: t.faollashtirish })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `${t.ochirish}: Ranglar va shakllar` }));
    const dialog = await screen.findByRole("dialog");
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: t.ochirish }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/v1/admin/kids/contents/1"));
  });

  it("Super Admin kutubxonani ko'rmaydi va API so'rovi yuborilmaydi", () => {
    mockUser = { role: "super_admin" };
    render(<OwnerPage />);
    expect(screen.getByRole("note")).toHaveTextContent(t.sa_taqiq);
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: t.qoshish })).not.toBeInTheDocument();
  });
});

describe("KIDDO Kids — tarbiyachi", () => {
  it("guruh tanlash, kategoriya va sevimlilar tablari backend filtriga uzatiladi", async () => {
    vi.mocked(api.get).mockResolvedValue(page([item()], { groups: groups.slice(1), group_id: 2 }));
    render(<TeacherPage />);
    await screen.findByTestId("kids-card");
    fireEvent.change(screen.getByLabelText(t.guruh), { target: { value: "3" } });
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.at(-1)?.[0]).toContain("group_id=3"));
    fireEvent.click(screen.getByRole("tab", { name: t.kat.music }));
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.at(-1)?.[0]).toContain("category=music"));
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(t.sevimlilar) }));
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.at(-1)?.[0]).toContain("favorites=1"));
    expect(screen.queryByRole("button", { name: t.qoshish })).not.toBeInTheDocument();     // boshqaruv huquqi yo'q
  });

  it("sevimlilarga qo'shish va mashg'ulotda foydalanishni qayd etish", async () => {
    vi.mocked(api.get).mockResolvedValue(page([item()], { groups: [groups[1]], group_id: 2 }));
    vi.mocked(api.put).mockResolvedValue({ is_favorite: true });
    vi.mocked(api.post).mockResolvedValue({ message: "ok" });
    render(<TeacherPage />);
    await screen.findByTestId("kids-card");

    fireEvent.click(screen.getByRole("button", { name: t.sevimli_qoshish }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/v1/teacher/kids/contents/1/favorite", { favorite: true }));
    expect(screen.getByRole("button", { name: t.sevimlidan_olish })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: t.tomosha }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: t.foydalandim }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/teacher/kids/contents/1/usage", { group_id: 2 }));
    expect(await screen.findByRole("status")).toHaveTextContent(t.foydalanish_qayd);
  });

  it("guruh biriktirilmagan bo'lsa tushunarli xabar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 }, groups: [], group_id: null });
    render(<TeacherPage />);
    expect(await screen.findByText(t.guruh_yoq)).toBeInTheDocument();
  });
});

describe("KIDDO Kids — xavfsiz YouTube pleyer", () => {
  it("youtube-nocookie embed, cheklangan sandbox va to'liq ekran", () => {
    render(<VideoPlayerModal content={item()} onClose={() => {}} />);
    const frame = screen.getByTestId("kids-player");
    expect(frame.getAttribute("src")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox");
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(screen.getByRole("button", { name: t.toliq_ekran })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.youtube_ochish })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("embed bloklangan yoki xavfsiz bo'lmagan manzil — iframe o'rniga xabar va YouTube havolasi", () => {
    const { unmount } = render(<VideoPlayerModal content={item({ embeddable: false })} onClose={() => {}} />);
    expect(screen.getByTestId("embed-blocked")).toHaveTextContent(t.embed_bloklangan);
    expect(screen.queryByTestId("kids-player")).not.toBeInTheDocument();
    unmount();
    render(<VideoPlayerModal content={item({ embed_url: "https://evil.example/embed/x" })} onClose={() => {}} />);
    expect(screen.queryByTestId("kids-player")).not.toBeInTheDocument();
  });

  it("pleyer 150 xatosini yuborsa (embed taqiqlangan) xabar ko'rsatiladi", async () => {
    render(<VideoPlayerModal content={item()} onClose={() => {}} />);
    const frame = screen.getByTestId("kids-player") as HTMLIFrameElement;
    window.dispatchEvent(new MessageEvent("message", { origin: "https://www.youtube-nocookie.com", source: frame.contentWindow, data: JSON.stringify({ event: "onError", info: 150 }) }));
    expect(await screen.findByTestId("embed-blocked")).toBeInTheDocument();
  });
});
