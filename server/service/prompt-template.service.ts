import { resolvePass3PromptTemplate } from "./prompt-template-pass3.service";

type InlineImageInput = {
  data: string;
  mimeType?: string;
};

type PromptTemplateParams = {
  model?: string;
  contents?: unknown;
  systemInstruction?: string;
  config?: Record<string, unknown>;
  generationConfig?: Record<string, unknown>;
};

function normalizeKey(value: unknown): string {
  return String(value || "")
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function imageParts(images: InlineImageInput[] = []) {
  return images.map((image) => ({
    inlineData: {
      data: image.data,
      mimeType: image.mimeType || "image/jpeg",
    },
  }));
}

function objectSchema(properties: Record<string, unknown>, required: string[]) {
  return {
    type: "OBJECT",
    properties,
    required,
  };
}

function stringField(description: string) {
  return { type: "STRING", description };
}

function numberField() {
  return { type: "NUMBER" };
}

function isPhotorealStyle(style: string) {
  const normalizedStyle = normalizeKey(style);
  return (
    normalizedStyle.includes("anh chup thuc te") ||
    normalizedStyle.includes("phoi canh thuc te") ||
    normalizedStyle.includes("photoreal") ||
    normalizedStyle.includes("realistic")
  );
}

function buildPhotorealismDirective(style: string, subject: "exterior" | "interior") {
  if (!isPhotorealStyle(style)) return "";

  const subjectLabel =
    subject === "exterior" ? "ngoai that cong trinh" : "noi that cong trinh";

  return [
    `Ưu tiên ngôn ngữ ảnh chụp ${subjectLabel} chân thực, không phải CGI hay concept art.`,
    "Mô tả như ảnh chụp bằng máy ảnh full-frame chuyên nghiệp, phối cảnh tự nhiên, vật liệu đúng scale, độ sau ảnh hợp lý.",
    "Bắt buộc thể hiện bề mặt có vi sai thực tế: mép vật liệu sắc vừa phải, phản xạ kính hợp lý, bóng đổ mềm đúng hướng sáng, texture không lặp lại.",
    "Ánh sáng phải giống ảnh đời thực đã hậu kỳ nhẹ: dynamic range cân bằng, white balance tự nhiên, không glow giả, không viền sáng ảo.",
    "Cho phép các dấu hiệu realism mức nhẹ như độ nhòe vật liệu, sai số thi công nhỏ, bụi bề mặt rất nhẹ, cây cối và người nếu có phải dùng tỷ lệ thực.",
    "Tránh tuyệt đối cảm giác render AI: oversharpen, bề mặt nhũ, vật liệu quá sạch, đối xứng hoàn hảo, ánh sáng sàn khâu, màu quá nồng, chi tiết bịa thêm.",
  ].join(" ");
}

function buildPhotorealNegativePrompt(style: string) {
  if (!isPhotorealStyle(style)) return "";

  return [
    "CGI",
    "3D render look",
    "concept art",
    "surreal",
    "plastic materials",
    "waxy surfaces",
    "fake reflections",
    "repeated textures",
    "oversaturated colors",
    "excessive contrast",
    "HDR overprocessed",
    "bloom",
    "glow",
    "floating objects",
    "warped geometry",
    "distorted perspective",
    "inconsistent scale",
    "perfect symmetry",
    "sterile surfaces",
    "artificial lighting",
    "game-engine look",
  ].join(", ");
}

function buildFloorplanCleanupDirective(mode: "space" | "axonometric") {
  if (mode === "space") {
    return [
      "Đây là ảnh render được diễn giải từ bản vẽ, không phải ảnh chụp lại bản vẽ.",
      "Chỉ được giữ logic bố trí, vị trí tường, cửa, cửa sổ, lối đi và nội thất theo floorplan.",
      "Tuyệt đối không được thêm, bớt, đổi chỗ, tách, nối, mở rộng, thu hẹp hay xoay bất kỳ thành phần kiến trúc nào so với bản vẽ gốc.",
      "Kiến trúc là ràng buộc cùng: tường, vách, cột, lối đi, cửa đi, cửa sổ, thông tầng, thang, sàn trong, lỗ gia, lối thoát hiểm, WC, hộp kỹ thuật, lõi giao thông và ranh giới phòng phải giữ nguyên vị trí và quan hệ không gian.",
      "Phải xóa hoàn toàn mọi dấu vết đồ họa của bản vẽ gốc: chữ, nhãn phòng, kích thước, dimension line, mũi tên, hatch, nét đứt, vien CAD, ký hiệu vật liệu, ký hiệu kỹ thuật, khung tên, watermark.",
      "Không để lại bất kỳ text, icon kỹ thuật, viền đen dày, nét phác thảo hay hiệu ứng blueprint nào trong ảnh cuối.",
      "Anh cuoi phai la khong gian 3D sach, thuc te, khong con dau vet mat bang 2D.",
    ].join(" ");
  }

  return [
    "Đây là phôi cảnh 3D axonometric được tải dụng từ floorplan 2D.",
    "Chỉ được giữ cấu trúc mặt bằng, tường, cửa, vách, thang, nhận diện không gian ở mục logic bố trí.",
    "Tuyệt đối không được thêm, bớt, đổi chỗ, tách, nối, mở rộng, thu hẹp hay xoay bất kỳ thành phần kiến trúc nào so với bản vẽ gốc.",
    "Mọi thành phần kiến trúc phải khóa cùng theo bản vẽ: tường, cột, vách, cửa đi, cửa sổ, lối thông tầng, lối đi, trục giao thông, lối thoát hiểm, WC, hộp kỹ thuật, sàn trong và ranh giới từng phòng.",
    "Phải xóa hoàn toàn chữ, nhãn phòng, số đo kích thước, hatch, ký hiệu CAD, đường tim, nét đứt, ký hiệu mở cửa, khung bản vẽ và mọi dấu vết đồ họa 2D không thuộc vật thể 3D.",
    "Kết quả phải là photorealistic architectural visualization cao cấp, không phải bản vẽ tô màu, minh họa hay mô hình đồ chơi.",
  ].join(" ");
}

function buildFloorplanNegativePrompt(mode: "space" | "axonometric") {
  if (mode === "space") {
    return [
      "text",
      "room labels",
      "dimensions",
      "dimension lines",
      "annotations",
      "arrows",
      "hatch patterns",
      "CAD lines",
      "dashed lines",
      "blueprint look",
      "technical drawing",
      "floorplan overlay",
      "watermark",
      "title block",
      "2D graphic remnants",
    ].join(", ");
  }

  return [
    "text",
    "room labels",
    "dimensions",
    "annotations",
    "missing walls",
    "extra walls",
    "shifted doors",
    "shifted windows",
    "altered room boundaries",
    "changed circulation",
    "invented architectural elements",
    "deleted architectural elements",
    "CAD symbols",
    "door swing markers",
    "grid lines",
    "hatch patterns",
    "blueprint style",
    "technical plan graphics",
    "2D overlay",
    "title block",
    "watermark",
    "white clay model",
    "monochrome",
    "grayscale",
    "raw plaster",
    "all-white rendering",
    "untextured model",
    "cartoon",
    "illustration",
    "anime",
    "dollhouse",
    "toy-like",
    "miniature model",
    "plastic materials",
    "game asset",
    "low-poly",
    "stylized CGI",
    "pastel toy palette",
    "exaggerated textures",
    "fake lighting",
    "flat shading",
    "uniform materials",
    "oversaturated colors",
  ].join(", ");
}

function buildRenderTabPrompt(input: Record<string, unknown>): PromptTemplateParams {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const description = String(input.description || "Không có");
  const style = String(input.style || "Không có");
  const roomType = String(input.roomType || "Không có");
  const interiorStyle = String(input.interiorStyle || "Không có");
  const lighting = String(input.lighting || "Không có");
  const colorTone = String(input.colorTone || "Không có");
  const context = String(input.context || "Không có");
  const buildingStyle = String(input.buildingStyle || "Không có");
  const cameraAngle = String(input.cameraAngle || "");
  const customCameraAngle = String(input.customCameraAngle || "");
  const cameraAngleStyle = String(input.cameraAngleStyle || "");
  const images = (input.images as InlineImageInput[] | undefined) || [];
  const referenceImages = (input.referenceImages as InlineImageInput[] | undefined) || [];

  // Determine whether this is a floorplan tab — reference images have a different role
  const isFloorplanTab =
    activeSubTabKey === "floorplan to 3d" || activeSubTabKey === "floorplan to 3d floorplan";

  const parts: Array<Record<string, unknown>> = [];
  if (images.length > 0) {
    if (isFloorplanTab) {
      parts.push({ text: "Ảnh bản vẽ mặt bằng / Floorplan gốc (Dùng để suy luận bố cục không gian: tường, cửa, cửa sổ, lối đi, vị trí phòng. KHÔNG xuất hiện dấu vết bản vẽ trong ảnh kết quả):" });
    } else {
      parts.push({ text: "Ảnh phác thảo / concept kiến trúc gốc (Cần bảo tồn tuyệt đối góc chụp, phối cảnh và hình khối này):" });
    }
    parts.push(...imageParts(images));
  }
  if (referenceImages.length > 0) {
    if (isFloorplanTab) {
      parts.push({ text: "Ảnh tham khảo nội thất mẫu (BẮT BUỘC: Giữ nguyên hoàn toàn vị trí, chủng loại và sắp xếp của từng món đồ nội thất xuất hiện trong ảnh này. KHÔNG được tự ý di chuyển, xoay, thêm hoặc bỏ bất kỳ món đồ nào. Chỉ áp dụng phong cách, màu sắc và vật liệu từ ảnh tham khảo; cấm thay đổi bố trí đồ đạc):" });
    } else {
      parts.push({ text: "Ảnh tham khảo phong cách / Moodboard (Chỉ học hỏi phong cách, màu sắc, vật liệu, ánh sáng; KHÔNG lấy góc chụp hay hình khối từ ảnh này):" });
    }
    parts.push(...imageParts(referenceImages));
  }

  let textPrompt = `Mô tả ý tưởng: ${description}\n`;
  let systemInstruction: string;
  let responseSchema: Record<string, unknown>;
  let thinkingLevel: "medium" | "high" = "medium";

  const selectedAngle = customCameraAngle || cameraAngle;
  const exteriorPhotorealDirective = buildPhotorealismDirective(style, "exterior");
  const interiorPhotorealDirective = buildPhotorealismDirective(style, "interior");
  const photorealNegativePrompt = buildPhotorealNegativePrompt(style);
  const floorplanSpaceCleanupDirective = buildFloorplanCleanupDirective("space");
  const floorplanAxonometricCleanupDirective = buildFloorplanCleanupDirective("axonometric");
  const floorplanSpaceNegativePrompt = buildFloorplanNegativePrompt("space");
  const floorplanAxonometricNegativePrompt = buildFloorplanNegativePrompt("axonometric");

  if (activeSubTabKey.includes("render ngoai that")) {
    textPrompt += `Style ảnh: ${style}\nTone màu: ${colorTone}\nBối cảnh: ${context}\nÁnh sáng: ${lighting}\n`;
    if (selectedAngle) {
      textPrompt += `Góc chụp: ${selectedAngle}\n`;
    }
    if (exteriorPhotorealDirective) {
      textPrompt += `Photoreal directive: ${exteriorPhotorealDirective}\n`;
    }
    systemInstruction = [
      "Bạn là chuyên gia biên soạn prompt render ngoại thất cho iGen.",
      "Tất cả phân tích và prompt cuối cùng phải viết bằng tiếng Việt rõ ràng, ngắn gọn, hữu dụng.",
      "BẮT BUỘC: Nếu có Ảnh phác thảo/concept gốc đầu vào, bạn PHẢI phân tích góc chụp của bức ảnh đó. Prompt cuối cùng được tạo ra PHẢI khớp hoàn toàn và bảo tồn tuyệt đối góc chụp (camera angle), phối cảnh (perspective), hình khối kiến trúc (geometry) và bố cục (layout) của ảnh phác thảo gốc. Không được thay đổi góc chụp dưới bất kỳ hình thức nào.",
      "Nếu có ảnh tham khảo phong cách, chỉ học hỏi tông màu, ánh sáng, vật liệu; tuyệt đối không lấy góc chụp hay hình khối từ ảnh phong cách.",
      "Nếu không có ảnh phác thảo gốc, được phép sáng tạo góc chụp hợp lý về kiến trúc.",
      "Nếu style là ảnh chụp thực tế, prompt cuối phải ép model theo ngôn ngữ nhiếp ảnh đời thực và chủ động loại bỏ cảm giác CGI hoặc AI.",
      "Hãy trả về JSON gồm phần phân tích ngắn gọn và prompt render cuối cùng tối ưu, tránh lặp lại, tránh lý thuyết thừa.",
    ].join(" ");
    responseSchema = objectSchema(
      {
        trang_thai_dau_vao_phat_hien: stringField("Xác định đang có ảnh tham khảo hay chỉ có văn bản."),
        phong_cach_va_tone_kien_truc: stringField("Tổng hợp phong cách kiến trúc và tone màu."),
        anh_sang_va_moi_truong: stringField("Phân tích ánh sáng, thời tiết, bối cảnh."),
        goc_may_anh_va_bo_cuc: stringField("Quy tắc góc máy và bố cục cần giữ."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cuối cùng bằng tiếng Việt để hiển thị."),
        optimized_english_prompt: stringField("Detailed, professional, photorealistic English rendering prompt for the image generator, strictly avoiding CGI/AI-style artifacts."),
        prompt_phu_dinh: stringField("Các lỗi cần tránh khi render."),
      },
      [
        "trang_thai_dau_vao_phat_hien",
        "phong_cach_va_tone_kien_truc",
        "anh_sang_va_moi_truong",
        "goc_may_anh_va_bo_cuc",
        "prompt_tieng_viet_toi_uu",
        "optimized_english_prompt",
        "prompt_phu_dinh",
      ],
    );
  } else if (activeSubTabKey.includes("render noi that")) {
    textPrompt += `Style ảnh: ${style}\nChức năng phòng: ${roomType}\nPhong cách nội thất: ${interiorStyle}\nÁnh sáng: ${lighting}\nTone màu: ${colorTone}\n`;
    if (selectedAngle) {
      textPrompt += `Góc chụp: ${selectedAngle}\n`;
    }
    if (interiorPhotorealDirective) {
      textPrompt += `Photoreal directive: ${interiorPhotorealDirective}\n`;
    }
    systemInstruction = [
      "Bạn là chuyên gia biên soạn prompt render nội thất cao cấp.",
      "Tất cả đầu ra phải bằng tiếng Việt, nhấn mạnh công năng phòng, vật liệu, bố cục và không khí ánh sáng.",
      "BẮT BUỘC: Nếu có Ảnh phác thảo/concept gốc đầu vào, bạn PHẢI phân tích góc chụp của bức ảnh đó. Prompt cuối cùng được tạo ra PHẢI khớp hoàn toàn và bảo tồn tuyệt đối góc chụp (camera angle), phối cảnh (perspective), hình khối và bố cục phòng của ảnh phác thảo gốc. Không được thay đổi góc chụp dưới bất kỳ hình thức nào.",
      "Nếu có ảnh tham khảo phong cách, chỉ học hỏi tông màu, ánh sáng, bày biện; tuyệt đối không lấy góc chụp hay hình khối từ ảnh phong cách.",
      "Nếu không có ảnh phác thảo gốc, được phép tự thiết lập phối cảnh hợp lý.",
      "Nếu style là ảnh chụp thực tế, prompt cuối phải mô tả vật liệu, ánh sáng và cảm giác ống kính như ảnh nội thất đời thực, tránh showroom CGI.",
      "Trả về JSON ngắn gọn, đúng trọng tâm, tập trung vào prompt cuối dùng được ngay.",
    ].join(" ");
    responseSchema = objectSchema(
      {
        phan_tich_y_dinh_goc: stringField("Tóm tắt ý định người dùng."),
        chuc_nang_phong_suy_luan: stringField("Suy luận công năng phòng."),
        phong_cach_noi_that_va_anh_sang: stringField("Tổng hợp phong cách, vật liệu, ánh sáng."),
        danh_sach_noi_that_va_vat_lieu: stringField("Những thành phần nội thất cần có."),
        logic_camera_va_ty_le_khung_hinh: stringField("Quy tắc góc chụp và tỷ lệ khung hình."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cuối cùng bằng tiếng Việt để hiển thị."),
        optimized_english_prompt: stringField("Detailed, professional, photorealistic English rendering prompt for the image generator, strictly avoiding CGI/AI-style artifacts."),
        prompt_phu_dinh: stringField("Các lỗi cần tránh."),
      },
      [
        "phan_tich_y_dinh_goc",
        "chuc_nang_phong_suy_luan",
        "phong_cach_noi_that_va_anh_sang",
        "danh_sach_noi_that_va_vat_lieu",
        "logic_camera_va_ty_le_khung_hinh",
        "prompt_tieng_viet_toi_uu",
        "optimized_english_prompt",
        "prompt_phu_dinh",
      ],
    );
  } else if (activeSubTabKey === "floorplan to 3d") {
    textPrompt += `Style render: ${style}\nLoại phòng: ${roomType}\nPhong cách: ${interiorStyle}\nGiữ đúng bố cục mặt bằng, tường, cửa, nội thất theo floorplan.\nYêu cầu làm sạch bản vẽ: ${floorplanSpaceCleanupDirective}\n`;
    if (referenceImages.length > 0) {
      textPrompt += `Quy tắc ảnh tham khảo nội thất: Giữ nguyên tuyệt đối vị trí, loại và sắp xếp của từng món đồ nội thất có trong ảnh tham khảo (giường, tủ, bàn, ghế, đèn, v.v.). TUYỆT ĐỐI không di chuyển, xoay, thêm hoặc bỏ bất kỳ món đồ nào so với ảnh tham khảo. Chỉ được phép áp dụng phong cách hoàn thiện bề mặt (màu sắc, vật liệu, ánh sáng) từ ảnh tham khảo lên vị trí đồ vật đã cố định.\n`;
    }
    if (selectedAngle) {
      textPrompt += `Góc chụp: ${selectedAngle}\n`;
    }
    if (cameraAngleStyle) {
      textPrompt += `Style góc chụp: ${cameraAngleStyle}\n`;
    }
    textPrompt += `Negative prompt ưu tiên: ${floorplanSpaceNegativePrompt}\n`;
    systemInstruction = [
      "Bạn là chuyên gia chuyển mặt bằng thành không gian 3D.",
      "Mục tiêu là dựng lại không gian từ floorplan thật chính xác, không được phá vỡ bố cục.",
      "BẮT BUỘC: Nếu có Góc chụp được chỉ định, bạn PHẢI ưu tiên và tuân thủ tuyệt đối góc chụp (camera angle) đó làm bố cục chính của khung cảnh. Loại bỏ hoàn toàn góc chụp mặc định từ cửa ra vào hoặc các góc khác nếu góc chụp được chỉ định là khác.",
      "Phải phân biệt ro rang giua du lieu bo cuc can giu va dau vet do hoa ban ve can xoa bo.",
      "Không được phép suy luận sang tạo vào kiến trúc nếu bản vẽ không thể hiện; ưu tiên bảo tồn ý nguyên bản vẽ hơn thẩm mỹ hình ảnh.",
      "Nếu có thể nhận diện đồ nội thất từ bản vẽ hoặc ảnh tham khảo, từng món phải giữ đúng loại, vị trí, hướng và quan hệ không gian; không được tự ý di chuyển, xoay, thêm hoặc bỏ.",
      referenceImages.length > 0
        ? "Khi có ảnh tham khảo nội thất: chỉ được học phong cách hoàn thiện bề mặt từ ảnh tham khảo, còn layout đồ vật và kiến trúc phải bất biến theo bản vẽ và vị trí nhận diện được từ đầu vào."
        : "Nếu không có ảnh tham khảo nội thất, chỉ dựng những gì suy ra được chắc chắn từ bản vẽ và thông số người dùng cung cấp.",
      "Tất cả đầu ra phải bằng tiếng Việt và tập trung vào prompt cuối khả thi cho image model.",
    ].join(" ");
    responseSchema = objectSchema(
      {
        phan_tich_mat_bang: stringField("Tóm tắt nhận diện mặt bằng."),
        logic_phong_cach_va_tham_khao: stringField("Tổng hợp phong cách áp dụng. Nếu có ảnh tham khảo nội thất, liệt kê rõ từng món đồ và vị trí cần giữ."),
        logic_che_do_render_va_camera: stringField("Lựa chọn góc chụp và chế độ render."),
        so_do_bo_tri_noi_that: stringField("Sơ đồ bố trí nội thất bất biến: liệt kê từng món đồ và vị trí cụ thể theo bản vẽ và ảnh tham khảo (nếu có). Không được thay đổi."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cuối cùng. Phải nêu rõ vị trí từng món đồ nội thất không được thay đổi."),
        prompt_phu_dinh: stringField("Các lỗi cần tránh, bao gồm: moved furniture, repositioned objects, rearranged interior."),
      },
      [
        "phan_tich_mat_bang",
        "logic_phong_cach_va_tham_khao",
        "logic_che_do_render_va_camera",
        "so_do_bo_tri_noi_that",
        "prompt_tieng_viet_toi_uu",
        "prompt_phu_dinh",
      ],
    );
  } else if (activeSubTabKey === "floorplan to 3d floorplan") {
    textPrompt += `Loại ảnh: floorplan 2D kỹ thuật.\nStyle công trình: ${buildingStyle}\nPhong cách: ${interiorStyle}\nKhông được biến floorplan thành ảnh nội thất thông thường.\nYêu cầu làm sạch bản vẽ: ${floorplanAxonometricCleanupDirective}\nPHOTOREAL PBR BẮT BUỘC: Create a high-end photorealistic architectural visualization. Use true-scale PBR materials with correct roughness, reflection, normal/bump detail and non-repeating textures. Use physically plausible natural lighting, neutral exposure and white balance, soft contact shadows, restrained ambient occlusion and realistic indirect bounce light. Bề mặt có sai khác nhỏ tự nhiên, không quá sạch hoặc bóng nhựa.\nROOM MANIFEST BẮT BUỘC: Đọc/OCR từng nhãn phòng, xác định ranh giới tường khép kín chứa nhãn, vị trí, diện tích ghi trên bản vẽ và các phòng tiếp giáp. Room labels are the source of truth and override furniture-based guesses. Tạo exact room count theo từng công năng. Never split, never merge, never relabel, never relocate, never add and never delete any labeled room. Prompt render cuối phải nhúng nguyên room_manifest và room_count_validation.\nQuy tắc bảo toàn hướng: không rotate, flip hoặc mirror; trên, dưới, trái, phải phải giữ nguyên.\nNội thất phải được map vào phòng sau khi room manifest đã khóa; không được dùng nội thất để đổi công năng ghi trên nhãn.\n`;
    if (referenceImages.length > 0) {
      textPrompt += `Quy tắc ảnh tham khảo nội thất: Giữ nguyên tuyệt đối vị trí, loại và sắp xếp của từng món đồ nội thất có trong ảnh tham khảo. TUYỆT ĐỐI không di chuyển, xoay, thêm hoặc bỏ bất kỳ món đồ nào. Chỉ được áp dụng phong cách hoàn thiện bề mặt từ ảnh tham khảo lên vị trí đồ vật đã cố định theo bản vẽ.\n`;
    }
    if (cameraAngleStyle) {
      textPrompt += `Style góc chụp: ${cameraAngleStyle}\n`;
    }
    textPrompt += `Negative prompt ưu tiên: ${floorplanAxonometricNegativePrompt}\n`;
    systemInstruction = [
      "Bạn là chuyên gia phân tích floorplan 2D và tái dựng thành không gian 3D axonometric chính xác.",
      "BẮT BUỘC BẢO TOÀN HƯỚNG BẢN VẼ: Đây là quy tắc tối thượng. Trước tiên hãy xác định hướng orientation của bản vẽ 2D đầu vào (góc trên-trái, trên-phải, dưới-trái, dưới-phải tương ứng với khu vực nào của mặt bằng). Hướng này PHẢI được bảo toàn tuyệt đối trong ảnh kết quả 3D. TUYỆT ĐỐI KHÔNG ĐƯỢC XOAY (rotate), LẬT (flip) hay PHẢN CHIẾU (mirror) bố cục mặt bằng dưới bất kỳ hình thức nào — kể cả để làm cho góc isometric 'đẹp hơn' hay 'cân đối hơn'. Phía trên bản vẽ = phía trên ảnh output. Phía phải bản vẽ = phía phải ảnh output. Vi phạm quy tắc này là lỗi nghiêm trọng nhất.",
      "BẮT BUỘC NHẬN DIỆN NỘI THẤT CHẶT CHẼ: Phân tích và map từng ký hiệu đồ nội thất trong bản vẽ 2D theo chuẩn ký hiệu CAD kiến trúc: hình chữ nhật dài (≥1.5m) tựa tường = giường (single/double); hình cung tròn cạnh tường = cửa xoay (door swing); hình chữ nhật nhỏ tựa tường trong phòng vệ sinh = toilet; hình chữ nhật nhỏ hơn ở góc = lavabo; hình bán cầu/oval lớn = bồn tắm; hình oval/chữ nhật bo cạnh trung tâm phòng = bàn ăn; hình chữ L/U với đệm = sofa góc; hình vuông/chữ nhật nhỏ quanh bàn = ghế riêng lẻ; hình chữ nhật dài song song tựa tường = kệ sách/tủ quần áo/tủ bếp; hình vuông nhỏ với vòng tròn = bếp hob. Mỗi ký hiệu PHẢI được map đúng sang đồ vật 3D và đặt đúng vị trí, đúng hướng xoay trong output.",
      "BẮT BUỘC TUÂN THỦ GÓC CHỤP: Bạn PHẢI tuân thủ tuyệt đối 'Style góc chụp' (cameraAngleStyle) được chỉ định. Nếu là 'Top-down View', prompt BẮT BUỘC phải mô tả góc nhìn thẳng đứng trực diện từ trên xuống (flat 3D floor plan layout, straight top-down view, 90-degree bird's-eye view, no perspective distortion of walls, looking directly down at the floor, orthographic layout view). Nếu là 'Phối cảnh Trực đo (Isometric)', prompt BẮT BUỘC phải mô tả phối cảnh trục đo 3D (3D isometric cutaway perspective, axonometric cutaway view, tilted angle view). Tuyệt đối không được nhầm lẫn giữa hai góc nhìn này.",
      "BẮT BUỘC NHẬN DIỆN PHÒNG: Hãy đọc kỹ ảnh mặt bằng, tìm và nhận diện đúng tất cả nhãn chữ chỉ tên/công năng phòng. Mô tả chi tiết vị trí từng khu vực chức năng trong prompt cuối cùng. Tuyệt đối không được tự ý đổi công năng phòng (không biến WC thành phòng ngủ, không vẽ nhầm phòng ngủ thành phòng khách).",
      "ROOM MANIFEST IS IMMUTABLE: Room labels are the source of truth. Produce one manifest entry per labeled enclosed space, preserve its exact label, boundary, position, adjacency and written area, then calculate the exact room count by function. Never split a room, never merge rooms, never relabel a room, never relocate a room, and never add or delete a room. Furniture symbols may refine furniture only; they must never override a room label. Embed the complete manifest and count validation verbatim in the final render prompt.",
      "VISUAL QUALITY IS PHOTOREAL PBR: The final prompt must demand a high-end photorealistic architectural visualization with true-scale PBR materials and physically plausible natural lighting. Preserve realistic roughness, reflections, texture scale, contact shadows, indirect bounce light and subtle surface imperfections. Explicitly reject cartoon, illustration, anime, dollhouse, toy-like, miniature, plastic, low-poly and stylized CGI aesthetics.",
      "Mặt bằng là sự thật tuyệt đối: tường, cửa, thang, vách và nhãn phòng phải được tôn trọng. Không được phép bổ sung, xóa bỏ hoặc sửa đổi bất kỳ thành phần kiến trúc nào không có trong bản vẽ; nếu không chắc, phải giữ nguyên thay vì tự bịa.",
      "Nhãn phòng và ký hiệu chỉ dùng để suy luận bố trí, không được xuất hiện lại trong ảnh kết quả.",
      "Mô hình 3D axonometric phải được tô màu chân thực, tự nhiên và chính xác cho sàn, tường, và đồ nội thất theo phong cách thiết kế đã chọn. KHÔNG được tạo mô hình đất sét trắng (white clay model) hay đơn sắc trắng.",
      referenceImages.length > 0
        ? "Khi có ảnh tham khảo nội thất: từng món đồ tham khảo chỉ được dùng để khóa đúng chủng loại, hướng và vị trí tương ứng theo mặt bằng; không tự ý thêm bớt hay di chuyển."
        : "Nếu không có ảnh tham khảo nội thất, bố trí đồ đạc phải bám logic mặt bằng và chỉ dựng những gì suy ra chắc chắn từ bản vẽ.",
      "FURNITURE COVERAGE ORDER: Process every enclosed room from top-to-bottom and left-to-right. Complete both passes for one room before moving to the next room.",
      "PASS A — MOVABLE FURNITURE: Inventory every visible bed, nightstand, sofa, armchair, table, individual chair, desk, movable cabinet, shelf, bench, and other recognizable loose object.",
      "PASS B — FIXED FIXTURES AND BUILT-INS: Inventory every visible toilet, lavatory, bathtub, shower, kitchen hob, sink, counter, built-in kitchen cabinet, wardrobe, and other recognizable fixed item.",
      "COVERAGE AUDIT: Inspect every footprint or CAD symbol that is not a wall, opening, text, dimension, or annotation and classify it exactly once. Correct every omission and duplicate before composing the final prompt. Never collapse repeated items into a set; list each chair and every other repeated object separately.",
      "SINGLE MODEL OUTPUT — EXACTLY ONE UNIFIED 3D FLOORPLAN MODEL: Render the complete reconstruction as one centered model and the only subject on the canvas. All rooms, stairs, corridors, walls, and wings must remain joined in their original architectural relationship.",
      "Never create a second floorplan, duplicate model, detached fragment, floating plan component, side-by-side layout, split screen, inset, comparison, before-and-after view, presentation board, exploded arrangement, alternate design, or auxiliary diagram.",
      "Treat sheet borders, title blocks, revision tables, signatures, company logos, dimensions, grids, section markers, annotations, and surrounding white space only as technical-document graphics. Ignore them during reconstruction and never turn them into another subject or panel.",
      "LAYER 1 — LOCKED INVENTORY: Before writing the render prompt, inspect the source floorplan and lock one evidence-grounded inventory containing every enclosed room, its readable label or inferred function, boundary, relative position, adjacency, openings, circulation, and every visible furniture item mapped to its enclosing room with position and orientation.",
      "LAYER 2 — CONSISTENCY VERIFICATION: Compare the proposed final description against the locked inventory. Correct every mismatch in room count, function, boundary, adjacency, orientation, opening, circulation, furniture type, furniture position, and furniture direction before emitting the final prompt.",
      "When a label or CAD symbol is unclear, choose the single most plausible interpretation using geometry, CAD conventions, nearby objects, and spatial context. A guess still requires visible supporting evidence and must never create an additional unsupported room or furniture item.",
      "Write the final render prompt as compact professional English analytical prose in several coherent paragraphs. It must describe every detected room and every detected furniture item, then state the camera, styling, materials, lighting, PBR quality, and immutable preservation constraints.",
      "Return only the selected interpretation. Do not expose chain-of-thought, alternative guesses, confidence scores, JSON field names, or internal verification notes in the final prompt.",
    ].join(" ");
    responseSchema = objectSchema(
      {
        phan_tich_huong_ban_ve: stringField("XÁC NHẬN HƯỚNG BẮT BUỘC: Mô tả chính xác orientation của bản vẽ 2D đầu vào (góc trên-trái là khu vực nào, góc trên-phải là khu vực nào). Ghi rõ cam kết: hướng này SẼ ĐƯỢC GIỮ NGUYÊN trong ảnh output, không xoay, không lật."),
        phan_tich_phong_va_chuc_nang: stringField("Nhận diện và liệt kê tất cả các phòng/khu vực chức năng kèm nhãn tên và vị trí tương ứng trong bản vẽ (góc nào, cạnh nào, tiếp giáp phòng nào)."),
        room_manifest: {
          type: "ARRAY",
          description: "Danh sách bất biến, mỗi phần tử cho đúng một không gian có nhãn: tên nhãn nguyên văn | diện tích ghi trên bản vẽ | vị trí | ranh giới | tiếp giáp. Không chia, gộp, đổi tên hoặc dịch phòng.",
          items: { type: "STRING" },
        },
        room_count_validation: stringField("Exact room count theo từng nhãn/công năng; xác nhận tổng số khớp với room_manifest và không có phòng tự sinh."),
        nhan_dien_noi_that_theo_phong: stringField("LIỆT KÊ TỪNG MÓN ĐỒ NỘI THẤT theo từng phòng: tên đồ vật được map từ ký hiệu CAD, vị trí trong phòng (góc nào, tựa tường nào), hướng đặt (xoay về phía nào), kích thước ước tính. Đây là ràng buộc cứng cho vị trí và loại đồ vật trong prompt cuối."),
        furniture_manifest: {
          type: "ARRAY",
          description: "Immutable inventory with exactly one visible item per entry, formatted as room | normalized item type | quantity 1 | relative position | orientation | visible CAD evidence. Include movable furniture, fixed fixtures and built-ins. Never group repeated items.",
          items: { type: "STRING" },
        },
        furniture_count_validation: stringField("Exact furniture and fixture counts by room and item type; confirm the grand total matches furniture_manifest with no omitted or duplicate CAD footprint."),
        logic_phong_cach_va_cong_trinh: stringField("Tổng hợp phong cách và logic công trình."),
        thiet_lap_anh_sang_va_studio: stringField("Thiết lập ánh sáng và cách trình bày."),
        prompt_tieng_viet_toi_uu: stringField("Prompt render cuối cùng. PHẢI mô tả rõ: (1) xác nhận hướng bố cục không thay đổi so với bản vẽ gốc, (2) vị trí cụ thể từng phòng, (3) từng món đồ nội thất đúng vị trí và hướng như đã nhận diện."),
        optimized_english_prompt: stringField("Final renderer-ready English analytical prose in several compact paragraphs. It must describe every detected room with position, boundary and adjacency; every detected furniture item grouped by room with position and orientation; the exact camera and source orientation; selected style, materials, lighting and photoreal PBR quality; and explicit prohibitions against adding, deleting, splitting, merging, relabeling, relocating or resizing rooms and adding, deleting, replacing or moving furniture. Never summarize the inventory with etc., other furniture, a dining set, or a furnished room. The prompt must require exactly one centered unified 3D floorplan model as the only canvas subject, with every architectural region joined and no second, duplicate, detached, inset, or side-by-side model."),
        prompt_phu_dinh: stringField("Các lỗi cần tránh, bao gồm: rotated layout, flipped plan, mirrored orientation, wrong furniture placement, misidentified room function, missing furniture, added furniture not in plan, rotated floor plan."),
      },
      [
        "phan_tich_huong_ban_ve",
        "phan_tich_phong_va_chuc_nang",
        "room_manifest",
        "room_count_validation",
        "nhan_dien_noi_that_theo_phong",
        "furniture_manifest",
        "furniture_count_validation",
        "logic_phong_cach_va_cong_trinh",
        "thiet_lap_anh_sang_va_studio",
        "prompt_tieng_viet_toi_uu",
        "optimized_english_prompt",
        "prompt_phu_dinh",
      ],
    );
  } else {
    textPrompt += `Style ảnh: ${style}\nTone màu: ${colorTone}\nBối cảnh: ${context}\nÁnh sáng: ${lighting}\n`;
    if (selectedAngle) {
      textPrompt += `Góc chụp: ${selectedAngle}\n`;
    }
    textPrompt += [
      "Ràng buộc masterplan: phải giữ nguyên logic phân khu, mạng lưới giao thông, vị trí công trình, mặt nước, cây xanh, tiện ích, khoảng lùi và quan hệ không gian theo bản vẽ gốc.",
      "Không được tự thêm, bớt, di chuyển, xoay hoặc hoán đổi các khối công trình, đường nội bộ, quảng trường, hồ cảnh quan hay cụm chức năng nếu đầu vào không thể hiện.",
      "Phải xóa sạch mọi chữ, ký hiệu quy hoạch, dimension, mũi tên, lưới trục, ghi chú CAD, legend và watermark khỏi ảnh kết quả.",
      "Nếu bản vẽ không rõ một chi tiết, ưu tiên giữ logic hiện trạng gần nhất thay vì tự sáng tác bố cục mới.",
    ].join(" ") + "\n";
    systemInstruction = [
      "Bạn là chuyên gia biên soạn prompt masterplan 3D.",
      "Mục tiêu là dựng lại masterplan 3D bám sát bản vẽ quy hoạch gốc, ưu tiên tính đúng đắn không gian hơn hiệu ứng đẹp mắt.",
      "Không được sáng tác lại zoning, massing, đường giao thông hay thêm bớt tiện ích ngoài dữ liệu đầu vào.",
      "Trả về JSON ngắn gọn và prompt cuối có thể render được ngay.",
    ].join(" ");
    thinkingLevel = "high";
    responseSchema = objectSchema(
      {
        masterplan_analysis: stringField("Tóm tắt mặt bằng tổng thể."),
        massing_and_zoning_logic: stringField("Logic phân khu và hình khối."),
        camera_and_scale_logic: stringField("Logic góc nhìn và tỷ lệ."),
        style_lighting_and_context: stringField("Tổng hợp phong cách, ánh sáng, bối cảnh."),
        optimized_english_prompt: stringField("Prompt cuối cùng."),
        negative_prompt: stringField("Các lỗi cần tránh, đặc biệt lỗi bịa zoning, sai giao thông, sai vị trí khối công trình và còn sót annotation quy hoạch."),
      },
      [
        "masterplan_analysis",
        "massing_and_zoning_logic",
        "camera_and_scale_logic",
        "style_lighting_and_context",
        "optimized_english_prompt",
        "negative_prompt",
      ],
    );
  }

  if (photorealNegativePrompt) {
    textPrompt += `Negative prompt ưu tiên: ${photorealNegativePrompt}\n`;
  }

  parts.push({ text: textPrompt.trim() });

  return {
    contents: [{ role: "user", parts }],
    systemInstruction,
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema,
      thinkingConfig: { thinkingLevel },
    },
  };
}

function buildRenderEditPrompt(input: Record<string, unknown>): PromptTemplateParams {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const description = String(input.description || "Không có");
  const cropInfo = String(input.cropInfo || "");
  const images = (input.images as InlineImageInput[] | undefined) || [];
  const parts: Array<Record<string, unknown>> = [...imageParts(images)];

  const textPrompt = `Mô tả thay đổi: ${description}\n${cropInfo}\n`;
  let systemInstruction: string;
  const config: Record<string, unknown> = {
    temperature: 0.4,
    responseMimeType: "application/json",
  };

  if (activeSubTabKey.includes("crop")) {
    systemInstruction = [
      "Bạn là chuyên gia tạo inpaint prompt cho kiến trúc.",
      "Chỉ được phép sửa trong vùng được chỉ định, phần còn lại phải giữ nguyên bố cục, chất liệu, ánh sáng và perspective.",
      "Trả về JSON với ý định sửa, phân tích bối cảnh, aspect ratio, prompt inpaint cuối cùng và negative prompt.",
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        edit_intent: stringField("Phân loại replace, add hoặc remove."),
        spatial_context_analysis: stringField("Tóm tắt bối cảnh trong vùng sửa."),
        detected_aspect_ratio: stringField("Aspect ratio suy ra từ ảnh."),
        optimized_inpaint_prompt: stringField("Prompt inpaint bằng tiếng Anh."),
        coordinates_lock: {
          type: "OBJECT",
          properties: {
            x: numberField(),
            y: numberField(),
            width: numberField(),
            height: numberField(),
          },
        },
        negative_prompt: stringField("Những lỗi cần tránh."),
      },
      [
        "edit_intent",
        "spatial_context_analysis",
        "detected_aspect_ratio",
        "optimized_inpaint_prompt",
        "coordinates_lock",
        "negative_prompt",
      ],
    );
  } else if (activeSubTabKey.includes("tong the")) {
    systemInstruction = [
      "Bạn là chuyên gia retouch và tái biên soạn prompt edit ảnh.",
      "Không được viết prompt dạng ra lệnh từng bước; phải mô tả trạng thái cuối của ảnh.",
      "Phải xác định những thành phần cần khóa để giữ nguyên cấu trúc.",
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        original_intent_analysis: stringField("Tóm tắt yêu cầu của người dùng."),
        untouchable_elements: stringField("Những thành phần phải giữ nguyên."),
        augmented_details: stringField("Chi tiết được bổ sung để prompt đầy đủ."),
        global_lighting_and_atmosphere: stringField("Ánh sáng và không khí cần giữ."),
        optimized_english_prompt: stringField("Prompt edit cuối cùng."),
        negative_prompt: stringField("Những lỗi cần tránh."),
      },
      [
        "original_intent_analysis",
        "untouchable_elements",
        "augmented_details",
        "global_lighting_and_atmosphere",
        "optimized_english_prompt",
        "negative_prompt",
      ],
    );
  } else if (activeSubTabKey.includes("thay the model")) {
    systemInstruction = [
      "Bạn là chuyên gia thay thế vật thể trong ảnh bằng vật thể tham khảo.",
      "Phải giữ đúng perspective, scale, ánh sáng và các vật thể tương tác liên quan.",
    ].join(" ");
    config.temperature = 0.3;
    config.responseSchema = objectSchema(
      {
        intent_and_identification: stringField("Vật cũ cần thay và vật mới cần đưa vào."),
        analyze_original_object_and_space: stringField("Vị trí, scale, perspective của vật cũ."),
        analyze_reference_model: stringField("DNA của vật thể tham khảo."),
        perspective_reprojection_logic: stringField("Logic xoay đổi perspective."),
        physical_inheritance: stringField("Những vật phẩm tương tác cần giữ."),
        blending_physics: stringField("Logic ánh sáng và đổ bóng."),
        optimized_english_prompt: stringField("Prompt cuối cùng."),
        negative_prompt: stringField("Những lỗi cần tránh."),
      },
      [
        "intent_and_identification",
        "analyze_original_object_and_space",
        "analyze_reference_model",
        "perspective_reprojection_logic",
        "physical_inheritance",
        "blending_physics",
        "optimized_english_prompt",
        "negative_prompt",
      ],
    );
  } else if (activeSubTabKey.includes("them doi tuong")) {
    systemInstruction = [
      "Bạn là chuyên gia compositing đối tượng vào ảnh kiến trúc.",
      "Phải giữ DNA của đối tượng tham khảo nhưng cho phép đổi pose, scale và vị trí cho hợp cảnh.",
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        user_intent_analysis: stringField("Người dùng muốn thêm gì, ở đâu."),
        subject_dna_extraction: stringField("DNA thị giác của đối tượng."),
        spatial_and_occlusion_logic: stringField("Vị trí, layer trước sau, scale."),
        pose_and_state_morphing: stringField("Logic đổi tư thế của đối tượng."),
        surface_contact_physics: stringField("Tiếp xúc, trọng lượng, contact shadow."),
        environmental_lighting_sync: stringField("Đồng bộ ánh sáng."),
        optimized_english_prompt: stringField("Prompt cuối cùng."),
        negative_prompt: stringField("Những lỗi cần tránh."),
      },
      [
        "user_intent_analysis",
        "subject_dna_extraction",
        "spatial_and_occlusion_logic",
        "pose_and_state_morphing",
        "surface_contact_physics",
        "environmental_lighting_sync",
        "optimized_english_prompt",
        "negative_prompt",
      ],
    );
    config.thinkingConfig = { thinkingLevel: "high" };
  } else {
    systemInstruction = [
      "Bạn là chuyên gia đổi vật liệu kiến trúc trong ảnh.",
      "Chỉ thay đổi bề mặt mục tiêu, giữ nguyên toàn bộ nội thất và cấu trúc khác.",
    ].join(" ");
    config.responseSchema = objectSchema(
      {
        surface_identification: stringField("Bề mặt mục tiêu cần đổi vật liệu."),
        material_dna_extraction: stringField("DNA vật liệu cần áp dụng."),
        scale_and_tiling_logic: stringField("Logic scale và seamless tiling."),
        lighting_and_reflection_physics: stringField("Ánh sáng, phản xạ, phản chiếu."),
        untouchable_elements: stringField("Thành phần phải giữ nguyên."),
        optimized_english_prompt: stringField("Prompt cuối cùng."),
        negative_prompt: stringField("Những lỗi cần tránh."),
      },
      [
        "surface_identification",
        "material_dna_extraction",
        "scale_and_tiling_logic",
        "lighting_and_reflection_physics",
        "untouchable_elements",
        "optimized_english_prompt",
        "negative_prompt",
      ],
    );
    config.thinkingConfig = { thinkingLevel: "high" };
  }

  parts.push({ text: textPrompt.trim() });
  return {
    contents: [{ role: "user", parts }],
    config,
    systemInstruction,
  };
}

function buildEnhancePrompt(input: Record<string, unknown>): PromptTemplateParams {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const customPrompt = String(input.customPrompt || "Không có");
  const contextOption = String(input.contextOption || "Không có");
  const lightingOption = String(input.lightingOption || "Không có");
  const interiorRoomType = String(input.interiorRoomType || "Không có");
  const interiorStyle = String(input.interiorStyle || "Không có");
  const interiorLighting = String(input.interiorLighting || "Không có");
  const images = (input.images as InlineImageInput[] | undefined) || [];

  const parts: Array<Record<string, unknown>> = [...imageParts(images)];
  const textPrompt = activeSubTabKey.includes("ngoai that")
    ? `Mục tiêu: Cải thiện chất lượng render ngoại thất.\nYêu cầu bổ sung: ${customPrompt}\nBối cảnh: ${contextOption}\nÁnh sáng: ${lightingOption}`
    : `Mục tiêu: Cải thiện chất lượng render nội thất.\nYêu cầu bổ sung: ${customPrompt}\nLoại phòng: ${interiorRoomType}\nPhong cách: ${interiorStyle}\nÁnh sáng: ${interiorLighting}`;
  parts.push({ text: textPrompt });

  return {
    contents: [{ role: "user", parts }],
    systemInstruction: [
      "Bạn là chuyên gia nâng cấp prompt render iGen.",
      "Bảo tồn tuyệt đối cấu trúc, bố cục, góc máy và logic hình học của ảnh đầu vào.",
      "Chỉ nâng cấp vật liệu, ánh sáng, không khí, độ sắc nét và giá trị trình bày.",
      "Trả về JSON ngắn gọn bằng tiếng Việt với phân tích, optimized_english_prompt và negative_prompt.",
    ].join(" "),
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  };
}

function buildUpscalePrompt(input: Record<string, unknown>): PromptTemplateParams {
  const images = (input.images as InlineImageInput[] | undefined) || [];
  return {
    contents: [
      {
        role: "user",
        parts: [
          ...imageParts(images),
          { text: "Analyze this image and generate the upscaling prompt." },
        ],
      },
    ],
    systemInstruction: [
      "You are an elite image restoration analyst for architectural imagery.",
      "Describe exactly what exists in the blurry image and do not hallucinate new subjects or layout changes.",
      "Return JSON with analysis, optimized upscale prompt, and negative prompt.",
      "The optimized prompt must end with: ultra-sharp, highly detailed, 2K resolution, crystal clear, noise-free, high-fidelity restoration, crisp edges, masterpiece.",
    ].join(" "),
    generationConfig: {
      temperature: 0.6,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "medium" },
      responseSchema: objectSchema(
        {
          image_content_analysis: stringField("Deep analysis of visible content."),
          optimized_upscale_prompt: stringField("English upscale prompt."),
          negative_prompt: stringField("Upscale artifacts to avoid."),
        },
        [
          "image_content_analysis",
          "optimized_upscale_prompt",
          "negative_prompt",
        ],
      ),
    },
  };
}

function buildSyncAnalyzePrompt(input: Record<string, unknown>): PromptTemplateParams {
  const activeSubTab = String(input.activeSubTab || "");
  const activeSubTabKey = normalizeKey(activeSubTab);
  const images = (input.images as InlineImageInput[] | undefined) || [];

  if (activeSubTabKey.includes("dong bo cong trinh")) {
    return {
      contents: [
        {
          role: "user",
          parts: [
            ...imageParts(images),
            { text: "Vui lòng phân tích không gian trong ảnh kiến trúc và tạo đúng 30 gợi ý góc chụp phân bộ vào 3 nhóm: Góc Trung Cảnh (5 góc), Góc Cận Cảnh Nghệ Thuật (15 góc), và Góc Nội Thất (10 góc) theo cấu trúc JSON đã quy định." },
          ],
        },
      ],
      systemInstruction: [
        "Bạn là đạo diễn nhiếp ảnh kiến trúc chuyên nghiệp của iGen.",
        "BƯỚC 1 - PHÂN TÍCH ẢNH ĐẦU VÀO: Trước tiên hãy quan sát kỹ ảnh công trình được cung cấp và xác định: phong cách kiến trúc (tân cổ điển, hiện đại, tropical...), vật liệu bề mặt thực tế (stucco, ngói đỏ, đá, gỗ, kính...), màu sắc chủ đạo, đặc điểm nổi bật của công trình (mái hiên, cột, ban công, cửa sổ, mảng tường...), ánh sáng hiện tại và bối cảnh xung quanh (cây cối, đường xá, hàng rào...).",
        "BƯỚC 2 - TẠO GỢI Ý THEO 3 NHÓM CỐ ĐỊNH (tổng 30 gợi ý):",
        "NHÓM 1 'Góc Trung Cảnh' (5 gợi ý): Góc chụp từ khoảng cách vừa phải, ống kính 35-50mm, thấy được 1/2 đến toàn bộ mặt tiền công trình, vẫn còn thấy một phần bối cảnh xung quanh thực tế (cây, đường, hàng xóm). Mỗi gợi ý phải chỉ rõ: hướng máy ảnh đứng ở đâu, góc nghiêng bao nhiêu độ, thấy phần nào của công trình.",
        "NHÓM 2 'Góc Cận Cảnh Nghệ Thuật' (15 gợi ý): Zoom sát vào MỘT chi tiết kiến trúc cụ thể của công trình trong ảnh. Đây KHÔNG phải là ảnh toàn cảnh — chỉ thấy 1 bộ phận nhỏ: ví dụ kết cấu tường stucco dưới ánh nắng xiên, viên ngói đỏ sau mưa, tay nắm cửa gỗ nâu, chi tiết phào chỉ thạch cao, bóng đổ của mái hiên lên tường... Ống kính 85-200mm macro. Mỗi gợi ý phải gắn với VẬT LIỆU/CHI TIẾT CỤ THỂ quan sát được từ ảnh gốc.",
        "NHÓM 3 'Góc Nội Thất' (10 gợi ý): Tưởng tượng không gian BÊN TRONG công trình dựa trên phong cách kiến trúc đã quan sát. Mô tả góc chụp từ bên trong: ánh sáng tự nhiên qua cửa sổ, vật liệu sàn/tường/trần, sự kết nối các không gian, đồ nội thất phù hợp phong cách kiến trúc. Mỗi gợi ý phải chỉ rõ tên phòng và chi tiết không gian cụ thể.",
        "QUY TẮC BẮT BUỘC: (1) TUYỆT ĐỐI không thay đổi background/bối cảnh xung quanh công trình. Chỉ thay đổi góc máy ảnh, tiêu cự, vùng focus. (2) Mỗi display_title_vi phải là câu tiếng Việt đầy đủ 25-45 từ, mô tả cụ thể vật liệu/ánh sáng/không khí thực tế thấy trong ảnh, không được chung chung. (3) Mỗi hidden_api_prompt_en phải mô tả kỹ thuật nhiếp ảnh chuyên nghiệp: focal length, f-stop, lighting direction, material texture, composition rule.",
        "Phải trả về JSON với cấu trúc mental_blueprint và categories/shots."
      ].join(" "),
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            mental_blueprint: stringField("Phác thảo tinh thần của không gian."),
            categories: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  category_name: stringField("Tên nhóm góc chụp."),
                  shots: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        display_title_vi: stringField("Tiêu đề hiển thị."),
                        hidden_api_prompt_en: stringField("Prompt render cho shot."),
                      },
                      required: ["display_title_vi", "hidden_api_prompt_en"],
                    },
                  },
                },
                required: ["category_name", "shots"],
              },
            },
          },
          required: ["mental_blueprint", "categories"],
        },
      },
    };
  }

  return {
    contents: [
      {
        role: "user",
        parts: [
          ...imageParts(images),
          {
            text: "Hãy phân tích bức ảnh nhân vật này và đưa ra các gợi ý về các góc máy và tư thế khác nhau để làm nổi bật nhân vật.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  };
}

function buildSyncSuggestionUpdatePrompt(input: Record<string, unknown>): PromptTemplateParams {
  const currentTitle = String(input.currentTitle || "");
  const previousPrompt = String(input.previousPrompt || "");

  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Bạn là chuyên gia biên soạn prompt render kiến trúc.
Hãy dịch/tối ưu hóa tiêu đề góc chụp dưới đây thành prompt render tiếng Anh chi tiết, bám sát ý tưởng của góc chụp và hình ảnh trước đó.

Tiêu đề tiếng Việt: "${currentTitle}"
Prompt tiếng Anh cũ (nếu có): "${previousPrompt}"

Yêu cầu trả về định dạng JSON duy nhất như sau:
{
  "display_title_vi": "Tiêu đề tiếng Việt",
  "hidden_api_prompt_en": "Detailed English rendering prompt"
}`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.5,
      responseMimeType: "application/json",
    },
  };
}

function buildSyncVariationGeneratePrompt(input: Record<string, unknown>): PromptTemplateParams {
  const promptInstruction = String(input.promptInstruction || "");
  const aspectRatio = String(input.aspectRatio || "16:9");
  const images = (input.images as InlineImageInput[] | undefined) || [];

  return {
    contents: [
      {
        role: "user",
        parts: [
          ...imageParts(images),
          { text: promptInstruction },
        ],
      },
    ],
    systemInstruction: [
      "Bạn là một chuyên gia kết xuất kiến trúc chân thực.",
      "Hãy sinh ảnh biến thể mới dựa trên ảnh kiến trúc gốc và chỉ dẫn mô tả của người dùng.",
      "Giữ nguyên 100% hình khối kiến trúc, tỉ lệ và cấu trúc chính của công trình gốc.",
      "BẮT BUỘC giữ nguyên 100% bối cảnh xung quanh (background), cảnh quan và môi trường của ảnh gốc. TUYỆT ĐỐI không thay đổi hay chỉnh sửa background hoặc bối cảnh xung quanh.",
      "Chỉ thay đổi góc máy, zoom, tiêu cự hoặc hướng camera để chụp cận cảnh/trung cảnh hoặc đặc tả các chi tiết/khu vực theo đúng mô tả của người dùng.",
    ].join(" "),
    config: {
      imageConfig: {
        aspectRatio,
      },
    },
  };
}

function buildCharacterGeneratePrompt(input: Record<string, unknown>): PromptTemplateParams {
  const characterPrompt = String(input.characterPrompt || "");
  const aspectRatio = String(input.aspectRatio || "1:1");

  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: characterPrompt },
        ],
      },
    ],
    systemInstruction: [
      "Bạn là chuyên gia tạo hình nhân vật chân thực.",
      "Hãy tạo ảnh chân dung hoặc toàn thân của nhân vật dựa trên mô tả của người dùng.",
      "Nhân vật phải có tỷ lệ giải phẫu học chính xác, khuôn mặt tự nhiên, không bị biến dạng.",
      "Ánh sáng studio rõ ràng, chi tiết da, tóc, quần áo sắc nét.",
    ].join(" "),
    config: {
      imageConfig: {
        aspectRatio,
      },
    },
  };
}

export function resolvePromptTemplate(
  templateKey: string,
  input: Record<string, unknown>,
): PromptTemplateParams {
  const pass3Template = resolvePass3PromptTemplate(templateKey, input);
  if (pass3Template) {
    return pass3Template;
  }

  switch (templateKey) {
    case "character_generate_prompt":
      return buildCharacterGeneratePrompt(input);
    case "sync_variation_generate_prompt":
      return buildSyncVariationGeneratePrompt(input);
    case "render_tab_prompt":
      return buildRenderTabPrompt(input);
    case "render_edit_prompt":
      return buildRenderEditPrompt(input);
    case "enhance_render_prompt":
      return buildEnhancePrompt(input);
    case "upscale_prompt":
      return buildUpscalePrompt(input);
    case "sync_analyze_prompt":
      return buildSyncAnalyzePrompt(input);
    case "sync_suggestion_update_prompt":
      return buildSyncSuggestionUpdatePrompt(input);
    case "sync_character_composite_prompt": {
      const imgArray = (input.images as InlineImageInput[] | undefined) || [];
      const parts: Array<Record<string, unknown>> = [];
      
      if (imgArray.length >= 2) {
        parts.push({ text: "Bối cảnh nền (Background Image):" });
        parts.push({
          inlineData: {
            data: imgArray[0].data,
            mimeType: imgArray[0].mimeType || "image/jpeg",
          },
        });
        parts.push({ text: "Nhân vật tham khảo (Character Reference Image):" });
        parts.push({
          inlineData: {
            data: imgArray[1].data,
            mimeType: imgArray[1].mimeType || "image/jpeg",
          },
        });
      } else {
        parts.push(...imageParts(imgArray));
      }

      parts.push({
        text: `Bạn là chuyên gia ghép nhân vật vào bối cảnh kiến trúc theo cách siêu thực.
Nhiệm vụ:
- Lấy nhân vật trong ảnh "Nhân vật tham khảo (Character Reference Image)" để ghép vào ảnh "Bối cảnh nền (Background Image)".
- Giữ nguyên 100% khuôn mặt, vóc dáng, mái tóc, quần áo và nhận diện của nhân vật từ ảnh "Nhân vật tham khảo".
- Đặt nhân vật vào bối cảnh của ảnh "Bối cảnh nền" theo đúng mô tả hành động dưới đây.
- Bảo tồn nguyên vẹn 100% bối cảnh nền. TUYỆT ĐỐI KHÔNG tự ý sinh thêm, chỉnh sửa hoặc thay thế bất kỳ chi tiết nào (bao gồm tường, cửa, trần, sàn, đồ đạc, vật dụng, đồ trang trí, cây cối, nội thất hoặc bất kỳ đồ vật nào khác) trong ảnh "Bối cảnh nền" nếu không có yêu cầu rõ ràng từ người dùng.
- Khóa cứng hoàn toàn cấu trúc không gian và cách bài trí nội thất hiện có của "Bối cảnh nền". Không di dời, thay đổi hình dáng hay loại bỏ bất cứ chi tiết nào. Chỉ được vẽ và đặt duy nhất nhân vật vào bối cảnh.
- Giữ nguyên 100% tỷ lệ khung hình, góc chụp (framing), và góc máy rộng (field of view) của ảnh "Bối cảnh nền". Tuyệt đối không tự ý cắt xén (crop) bên trái/bên phải/phía trên/phía dưới, không zoom cận cảnh hay thay đổi tiêu cự khung hình gốc.
- Đồng bộ tuyệt đối ánh sáng, hướng nắng, màu sắc môi trường, đổ bóng tiếp xúc và phối cảnh giữa nhân vật và bối cảnh nền.
- Không để nhân vật trông giống bị cắt ghép, lơ lửng hoặc sai tỷ lệ so với các đồ đạc xung quanh.

Yêu cầu hành động của nhân vật: ${String(input.userAction || "")}`,
      });

      return {
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          imageConfig: input.imageConfig as Record<string, unknown>,
        },
      };
    }
    case "utility_layout_prompt": {
      const toolName = String(input.toolName || "");
      const selectedStyle = String(input.selectedStyle || "Không có");
      let systemInstruction = "";
      let prompt: string;

      if (toolName === "Presentation Board") {
        systemInstruction =
          "Bạn là chuyên gia thiết kế đồ họa kiến trúc bậc thầy. Tất cả chữ và chú thích xuất hiện trong ảnh phải bằng tiếng Việt rõ ràng, trình bày như một bảng thuyết trình kiến trúc cao cấp.";
        prompt = `Tạo một bảng thuyết trình kiến trúc hoàn chỉnh theo phong cách ${selectedStyle}. Ảnh chính là công trình tham khảo, xung quanh có các sơ đồ phân tích, mặt bằng, chi tiết vật liệu và chú thích tiếng Việt sắc nét. Bố cục sạch, cân đối, trình bày như poster kiến trúc chuyên nghiệp.`;
      } else if (toolName === "Overall") {
        prompt = `Biến công trình tham khảo thành một bảng trình bày tổng thể landscape 16:9 theo phong cách ${selectedStyle}. Ảnh phải phủ kín nền, có tiêu đề kiến trúc sang trọng, hai inset phân tích nhỏ, bố cục editorial cao cấp, đồng bộ thẩm mỹ.`;
      } else if (toolName === "Layout") {
        prompt = `Tạo một competition board landscape 16:9 cho công trình tham khảo theo phong cách ${selectedStyle}. Trung tâm là exploded axonometric, xung quanh có sơ đồ massing, mặt cắt, context map và các text block ngắn, bố cục theo lưới Swiss Grid nghiêm ngặt.`;
      } else if (toolName === "Interior Moodboard") {
        prompt = `Tạo một interior moodboard landscape cao cấp cho không gian tham khảo theo phong cách ${selectedStyle}. Phải có hero render, material swatches, isometric cutaway và vài furniture cutout nổi trên nền, bố cục catalogue hiện đại.`;
      } else {
        const projectName = String(input.projectName || "ARCHITECTURAL PRESENTATION");
        prompt = `Tạo một advanced architectural presentation board khổ dọc 3:4 cho công trình tham khảo theo phong cách ${selectedStyle}. Có tiêu đề ${projectName}, bố cục 3 cột dày thông tin, massing evolution, axonometric, nội thất, mặt bằng, mặt đứng và footer đồ án.`;
      }

      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts((input.images as InlineImageInput[] | undefined) || []),
              { text: prompt },
            ],
          },
        ],
        systemInstruction: systemInstruction || undefined,
        config: {
          ...(input.requestConfig as Record<string, unknown>),
        },
      };
    }
    case "utility_process_prompt": {
      const userPrompt = String(input.userPrompt || "");
      const systemInstruction = String(input.systemInstruction || "");
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts((input.images as InlineImageInput[] | undefined) || []),
              { text: userPrompt },
            ],
          },
        ],
        systemInstruction,
        generationConfig: {
          imageConfig: {
            aspectRatio: String(input.aspectRatio || "1:1"),
            imageSize: String(input.imageSize || "1K"),
          },
        },
      };
    }
    case "virtual_staging_prompt": {
      const mode = String(input.mode || "virtual");
      const roomType = String(input.roomType || "");
      const style = String(input.style || "");
      const requestNotes = String(input.requestNotes || "");
      const extraPrompt = String(input.extraPrompt || "");
      const shapesDescription = String(input.shapesDescription || "");

      const basePrompt =
        mode === "virtual"
          ? `Bạn là chuyên gia thiết kế nội thất và dàn dựng không gian. Hãy thực hiện virtual staging cho căn phòng trống này theo phong cách ${style}, công năng ${roomType}. Bổ sung nội thất cao cấp, ánh sáng chuyên nghiệp và vật liệu chân thực, nhưng phải giữ chuẩn hình học không gian gốc.`
          : shapesDescription
            ? "Bạn là chuyên gia cải tạo nội thất chính xác theo vùng chọn. Chỉ được chỉnh sửa bên trong các marker đã đánh dấu, mọi khu vực ngoài marker phải giữ nguyên 1:1 so với ảnh gốc."
            : "Bạn là chuyên gia cải tạo nội thất. Hãy cải tạo không gian theo ghi chú người dùng nhưng phải giữ nguyên layout, cấu trúc kiến trúc và các đồ vật không được yêu cầu thay đổi.";

      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts((input.images as InlineImageInput[] | undefined) || []),
              {
                text: `${basePrompt}
${shapesDescription}
Ghi chú người dùng: ${requestNotes || "Không có"}
Yêu cầu bổ sung: ${extraPrompt || "Không có"}`,
              },
            ],
          },
        ],
        systemInstruction: [
          "Tất cả suy luận phải ưu tiên bảo toàn phối cảnh, tỷ lệ, cấu trúc không gian và ánh sáng thực tế.",
          "Nếu là chỉnh sửa chọn vùng, tuyệt đối không làm thay đổi đồ vật, cây xanh, vật dụng hay chi tiết ngoài vùng đánh dấu.",
          "Đầu ra phải là ảnh nội thất chân thực, sạch lỗi, không méo hình, không thêm vật thể vô lý.",
        ].join(" "),
      };
    }
    default:
      throw new Error(`Unknown prompt template key: ${templateKey}`);
  }
}
