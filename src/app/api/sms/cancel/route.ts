import { after } from "next/server";
import { cancelMessage, normalizePhone, sendSms, userClient, VISIT_SMS_SELECT, type VisitForSms } from "@/lib/sms";

// Cancels (deletes) an appointment and texts the patient about it 5 seconds later.
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId } = await request.json().catch(() => ({}));
  if (!appointmentId) return Response.json({ error: "appointmentId აკლია" }, { status: 400 });

  const db = userClient(token);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) {
    return Response.json({ error: `ავტორიზაცია ვერ დადასტურდა: ${authError?.message ?? ""}` }, { status: 401 });
  }
  const { data, error } = await db
    .from("appointments")
    .select(VISIT_SMS_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();
  if (error || !data) {
    return Response.json(
      { error: `ვიზიტი ვერ მოიძებნა (${error?.message ?? `id ${appointmentId}`})` },
      { status: 404 },
    );
  }
  const visit = data as unknown as VisitForSms;

  // Read the visit first: once deleted, the patient's phone and doctor are gone.
  const { error: deleteError } = await db.from("appointments").delete().eq("id", visit.id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  const to = normalizePhone(visit.patients?.phone);
  if (!to) return Response.json({ ok: true, warning: "პაციენტს მობილურის ნომერი არ აქვს, SMS არ გაიგზავნა" });

  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    try {
      await sendSms(to, cancelMessage(visit), `cancel-${visit.id}`);
    } catch (e) {
      console.error("[SMS] cancel failed:", (e as Error).message);
    }
  });
  return Response.json({ ok: true });
}
