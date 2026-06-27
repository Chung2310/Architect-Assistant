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
    `Uu tien ngon ngu anh chup ${subjectLabel} chan thuc, khong phai CGI hay concept art.`,
    "Mo ta nhu anh chup bang may anh full-frame chuyen nghiep, phoi canh tu nhien, vat lieu dung scale, do sau anh hop ly.",
    "Bat buoc the hien be mat co vi sai thuc te: mep vat lieu sac vua phai, phan xa kinh hop ly, bong do mem dung huong sang, texture khong lap gia.",
    "Anh sang phai giong anh doi thuc da hau ky nhe: dynamic range can bang, white balance tu nhien, khong glow gia, khong vien sang ao.",
    "Cho phep cac dau hieu realism muc nhe nhu do nham vat lieu, sai so thi cong nho, bui be mat rat nhe, cay coi va nguoi neu co phai dung ty le thuc.",
    "Tranh tuyet doi cam giac render AI: oversharpen, be mat nhua, vat lieu qua sach, doi xung hoan hao, anh sang san khau, mau qua no, chi tiet bia them.",
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
      "Day la anh render duoc dien giai tu ban ve, khong phai anh chup lai ban ve.",
      "Chi duoc giu logic bo cuc, vi tri tuong, cua, cua so, loi di va noi that theo floorplan.",
      "Phai xoa hoan toan moi dau vet do hoa cua ban ve goc: chu, nhan phong, kich thuoc, dimension line, mui ten, hatch, net dut, vien CAD, ky hieu vat lieu, ky hieu ky thuat, khung ten, watermark.",
      "Khong de lai bat ky text, icon ky thuat, vien den day, net phac thao hay hieu ung blueprint nao trong anh cuoi.",
      "Anh cuoi phai la khong gian 3D sach, thuc te, khong con dau vet mat bang 2D.",
    ].join(" ");
  }

  return [
    "Day la phoi canh 3D axonometric duoc tai dung tu floorplan 2D.",
    "Chi duoc giu cau truc mat bang, tuong, cua, vach, thang, nhan dien khong gian o muc logic bo cuc.",
    "Phai xoa hoan toan chu, nhan phong, so do kich thuoc, hatch, ky hieu CAD, duong tim, net dut, ky hieu mo cua, khung ban ve va moi dau vet do hoa 2D khong thuoc vat the 3D.",
    "Khong duoc de anh cuoi trong giong ban ve duoc to mau; phai la mo hinh 3D sach, ro, khong con annotation.",
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
    "CAD symbols",
    "door swing markers",
    "grid lines",
    "hatch patterns",
    "blueprint style",
    "technical plan graphics",
    "2D overlay",
    "title block",
    "watermark",
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
    if (cameraAngleStyle) {
      textPrompt += `Style góc chụp: ${cameraAngleStyle}\n`;
    }
    textPrompt += `Negative prompt ưu tiên: ${floorplanSpaceNegativePrompt}\n`;
    systemInstruction = [
      "Bạn là chuyên gia chuyển mặt bằng thành không gian 3D photorealistic.",
      "BƯỚC 1 - PHÂN TÍCH BẢN VẼ: Đọc kỹ bản vẽ mặt bằng, xác định loại phòng (phòng ngủ, phòng khách, bếp, v.v.) và liệt kê TOÀN BỘ đồ nội thất thực tế có trong bản vẽ cùng vị trí chính xác của từng món (ví dụ: phòng ngủ → giường đôi ở giữa, tủ quần áo bên phải, bàn trang điểm bên trái, táp đầu giường hai bên; phòng khách → sofa góc trái, bàn trà trước sofa, kệ TV đối diện, v.v.).",
      "BƯỚC 2 - CAMERA: Luôn dùng góc ngang tầm mắt nhìn từ cửa phòng đi vào. Không góc cao, không nhìn từ trên xuống. Đảm bảo thể hiện được các đồ nội thất chính của phòng.",
      "BƯỚC 3 - BẤT BIẾN VỊ TRÍ: Tất cả đồ đạc đã xác định ở BƯỚC 1 PHẢI xuất hiện đúng vị trí trong ảnh cuối. Không tự ý di chuyển, xoay, thêm hoặc bỏ bất kỳ món đồ nào.",
      "BƯỚC 4 - LÀM SẠCH BẢN VẼ: Xóa hoàn toàn mọi dấu vết đồ họa 2D (chữ, số kích thước, hatch, nét đứt, ký hiệu CAD) — chỉ giữ lại logic bố cục không gian.",
      referenceImages.length > 0
        ? "BẮT BUỘC KHI CÓ ẢNH THAM KHẢO NỘI THẤT: Từng món đồ nội thất trong ảnh tham khảo phải được giữ nguyên vị trí, hướng và loại đồ vật. TUYỆT ĐỐI không được tự ý di chuyển, đổi hướng, xóa hoặc thêm đồ vật so với ảnh tham khảo. Phong cách hoàn thiện (màu, vật liệu, ánh sáng) được học từ ảnh tham khảo nhưng layout đồ vật phải bất biến."
        : "Nếu không có ảnh tham khảo nội thất, bố trí nội thất theo đúng bố cục mặt bằng và phong cách được chỉ định.",
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
    textPrompt += `Loại ảnh: floorplan 2D kỹ thuật.\nStyle công trình: ${buildingStyle}\nPhong cách: ${interiorStyle}\nKhông được biến floorplan thành ảnh nội thất thông thường.\nYêu cầu làm sạch bản vẽ: ${floorplanAxonometricCleanupDirective}\n`;
    if (referenceImages.length > 0) {
      textPrompt += `Quy tắc ảnh tham khảo nội thất: Giữ nguyên tuyệt đối vị trí, loại và sắp xếp của từng món đồ nội thất có trong ảnh tham khảo. TUYỆT ĐỐI không di chuyển, xoay, thêm hoặc bỏ bất kỳ món đồ nào. Chỉ được áp dụng phong cách hoàn thiện bề mặt từ ảnh tham khảo lên vị trí đồ vật đã cố định theo bản vẽ.\n`;
    }
    if (cameraAngleStyle) {
      textPrompt += `Style góc chụp: ${cameraAngleStyle}\n`;
    }
    textPrompt += `Negative prompt ưu tiên: ${floorplanAxonometricNegativePrompt}\n`;
    systemInstruction = [
      "Bạn là chuyên gia phân tích floorplan 2D và tái dựng thành không gian 3D chính xác.",
      "Mặt bằng là sự thật tuyệt đối: tường, cửa, thang, vách và nhãn phòng phải được tôn trọng.",
      "Nhãn phòng và ký hiệu chỉ dùng để suy luận bố cục, không được xuất hiện lại trong ảnh kết quả.",
      referenceImages.length > 0
        ? "BẮT BUỘC KHI CÓ ẢNH THAM KHẢO NỘI THẤT: Từng món đồ trong ảnh tham khảo phải được đặt đúng vị trí, đúng hướng, đúng chủng loại trong ảnh kết quả. TUYỆT ĐỐI không tự ý di chuyển, đổi hướng, xóa hay thêm đồ vật so với ảnh tham khảo. Chỉ phong cách hoàn thiện bề mặt được học từ ảnh tham khảo."
        : "Nếu không có ảnh tham khảo nội thất, bố trí đồ đạc theo logic mặt bằng và phong cách được chỉ định.",
      "Tất cả đầu ra bằng tiếng Việt, ưu tiên prompt cuối dùng được ngay.",
    ].join(" ");
    responseSchema = objectSchema(
      {
        phan_tich_khoa_goc_ghi_hinh: stringField("Tóm tắt cách khóa logic floorplan."),
        logic_phong_cach_va_cong_trinh: stringField("Tổng hợp phong cách và logic công trình."),
        quyet_dinh_cat_tuong: stringField("Mô tả chiến lược cắt tường nếu cần."),
        thiet_lap_anh_sang_va_studio: stringField("Thiết lập ánh sáng và cách trình bày."),
        prompt_tieng_viet_toi_uu: stringField("Prompt cuối cùng."),
        prompt_phu_dinh: stringField("Các lỗi cần tránh."),
      },
      [
        "phan_tich_khoa_goc_ghi_hinh",
        "logic_phong_cach_va_cong_trinh",
        "quyet_dinh_cat_tuong",
        "thiet_lap_anh_sang_va_studio",
        "prompt_tieng_viet_toi_uu",
        "prompt_phu_dinh",
      ],
    );
  } else {
    textPrompt += `Style ảnh: ${style}\nTone màu: ${colorTone}\nBối cảnh: ${context}\nÁnh sáng: ${lighting}\n`;
    if (selectedAngle) {
      textPrompt += `Góc chụp: ${selectedAngle}\n`;
    }
    systemInstruction = [
      "Bạn là chuyên gia biên soạn prompt masterplan 3D.",
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
        negative_prompt: stringField("Các lỗi cần tránh."),
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
            { text: "Vui lòng phân tích không gian và tạo 30 góc chụp theo cấu trúc JSON đã quy định." },
          ],
        },
      ],
      systemInstruction: [
        "Bạn là tổng đạo diễn nghệ thuật và kiến trúc sư không gian của iGen.",
        "Hãy phân tích 1 ảnh kiến trúc tham khảo và tạo chính xác 30 góc chụp đồng bộ với nhau.",
        "Tất cả đầu ra phải bằng tiếng Việt rõ ràng, nhất quán, hữu dụng.",
        "Phải trả về JSON với mental_blueprint và categories/shots.",
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

export function resolvePromptTemplate(
  templateKey: string,
  input: Record<string, unknown>,
): PromptTemplateParams {
  const pass3Template = resolvePass3PromptTemplate(templateKey, input);
  if (pass3Template) {
    return pass3Template;
  }

  switch (templateKey) {
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
    case "sync_character_composite_prompt":
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts((input.images as InlineImageInput[] | undefined) || []),
              {
                text: `Bạn là chuyên gia ghép nhân vật vào bối cảnh kiến trúc theo cách siêu thực.
Nhiệm vụ:
- Giữ nguyên khuôn mặt, vóc dáng, quần áo và nhận diện của chủ thể tham khảo.
- Nếu yêu cầu người dùng trống, tự suy luận vị trí và tư thế phù hợp với ảnh nền.
- Đồng bộ tuyệt đối ánh sáng, màu môi trường, đổ bóng tiếp xúc và phối cảnh.
- Cho phép vi chỉnh rất nhẹ vật thể nền nếu cần để tạo tiếp xúc vật lý hợp lý.
- Không để chủ thể bị dán lên ảnh, lơ lửng, sai tỷ lệ hoặc lệch hướng sáng.

Yêu cầu người dùng: ${String(input.userAction || "")}`,
              },
            ],
          },
        ],
        config: {
          imageConfig: input.imageConfig as Record<string, unknown>,
        },
      };
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
