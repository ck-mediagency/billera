import { supabase } from "@/lib/supabaseClient";

export async function uploadAvatarForCurrentUser(file: File) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("Not authenticated");

  if (!file.type.startsWith("image/")) throw new Error("File must be an image");

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";

  // نخزن الصورة باسم ثابت حتى أي تعديل يستبدلها
  const path = `${user.id}/avatar.${safeExt}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (upErr) throw upErr;

  // bucket public → نجيب public URL مباشرة
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  return { publicUrl, path };
}
