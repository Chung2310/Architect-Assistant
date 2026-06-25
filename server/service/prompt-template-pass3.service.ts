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

function imageParts(images: InlineImageInput[] = []) {
  return images.map((image) => ({
    inlineData: {
      data: image.data,
      mimeType: image.mimeType || "image/jpeg",
    },
  }));
}

export function resolvePass3PromptTemplate(
  templateKey: string,
  input: Record<string, unknown>,
): PromptTemplateParams | null {
  switch (templateKey) {
    case "sync_character_composite_prompt":
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts((input.images as InlineImageInput[] | undefined) || []),
              {
                text: `Bạn là chuyên gia ghép nhân vật vào bối cảnh kiến trúc theo phong cách siêu thực.
Nhiệm vụ:
- Giữ nguyên khuôn mặt, vóc dáng, quần áo và nhận diện của chủ thể tham khảo.
- Nếu yêu cầu người dùng để trống, tự suy luận vị trí và tư thế phù hợp với ảnh nền.
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
      let prompt = "";

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

    case "utility_process_prompt":
      return {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts((input.images as InlineImageInput[] | undefined) || []),
              { text: String(input.userPrompt || "") },
            ],
          },
        ],
        systemInstruction: String(input.systemInstruction || ""),
        generationConfig: {
          imageConfig: {
            aspectRatio: String(input.aspectRatio || "1:1"),
            imageSize: String(input.imageSize || "1K"),
          },
        },
      };

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
      return null;
  }
}
