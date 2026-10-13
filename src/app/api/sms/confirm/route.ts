import { normalizePhone, sendSms, userClient, visitMessage, VISIT_SMS_SELECT, type VisitForSms } from "@/lib/sms";

// Sends the "your visit is booked" SMS right after an appointment is created.
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId } = await request.json().catch(() => ({}));
  if (!appointmentId) return Response.json({ error: "appointmentId აკლია" }, { status: 400 });

  const db = userClient(token);
  const { data, error } = await db
    .from("appointments")
    .select(VISIT_SMS_SELECT)
    .eq("id", appointmentId)
    .single();
  if (error || !data) return Response.json({ error: "ვიზიტი ვერ მოიძებნა" }, { status: 404 });

  const visit = data as unknown as VisitForSms;
  const to = normalizePhone(visit.patients?.phone);
  if (!to) return Response.json({ error: "პაციენტს მობილურის ნომერი არ აქვს" }, { status: 422 });

  try {
    await sendSms(to, visitMessage(visit), `confirm-${visit.id}-${visit.date}-${visit.time}`);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
  await db.from("appointments").update({ sms_confirm_sent_at: new Date().toISOString() }).eq("id", visit.id);
  return Response.json({ ok: true });
}
