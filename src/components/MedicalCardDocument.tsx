import { formatDateShort } from "@/lib/format";
import {
  COMPLAINTS_LEFT,
  COMPLAINTS_RIGHT,
  PERIO_OPTIONS,
  PLAN_LEFT,
  PLAN_RIGHT,
  PLAQUE_OPTIONS,
  PRIMARY_LOWER,
  PRIMARY_UPPER,
  TEETH_LOWER,
  TEETH_UPPER,
  TOOTH_CODES,
  type MedicalCardData,
} from "@/lib/medicalCard";
import type { Patient } from "@/lib/types";

/**
 * Plain CSS (not Tailwind) so the exact same markup works for browser printing
 * and for the Word (.doc) export, which only understands inline/embedded CSS.
 */
export const CARD_BASE_CSS = `
.mc-doc { font-family: Sylfaen, "Noto Sans Georgian", "DejaVu Sans", sans-serif; font-size: 10.5pt; line-height: 1.45; color: #000; }
.mc-page { width: 210mm; min-height: 297mm; padding: 16mm 14mm 16mm 20mm; box-sizing: border-box; background: #fff; margin: 0 auto 8mm; box-shadow: 0 1px 6px rgba(0,0,0,.15); }
.mc-doc p { margin: 0 0 4pt; }
.mc-title { text-align: center; font-weight: bold; font-size: 12.5pt; margin: 6pt 0 12pt !important; }
.mc-label { }
.mc-val { text-decoration: underline; }
.mc-empty { color: #000; letter-spacing: -0.5pt; }
.mc-line { border-bottom: 1px solid #000; min-height: 15pt; margin: 0 0 2pt !important; white-space: pre-wrap; }
.mc-annex { text-align: right; font-size: 9.5pt; margin: 0 !important; }
.mc-provider { border-bottom: 1px solid #000; width: 75mm; min-height: 14pt; margin: 6pt 0 0 !important; }
.mc-caption { font-size: 8.5pt; margin: 0 !important; }
.mc-form-no { font-size: 8.5pt; text-align: right; margin: -12pt 0 0 !important; }
.mc-section { font-weight: bold; margin-top: 8pt !important; }
.mc-box { font-family: "Segoe UI Symbol", "DejaVu Sans", sans-serif; font-size: 11pt; }
.mc-table { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; }
.mc-table td, .mc-table th { border: 1px solid #000; padding: 3pt 5pt; vertical-align: top; }
.mc-table th { font-weight: bold; text-align: center; }
.mc-opts { width: 100%; border-collapse: collapse; page-break-inside: avoid; break-inside: avoid; }
.mc-opts td { padding: 0 4pt 1pt 0; vertical-align: top; border: none; }
.mc-opts td.mc-check { width: 14pt; text-align: center; padding-right: 10pt; }
.mc-teeth { border-collapse: collapse; margin: 4pt auto 2pt; page-break-inside: avoid; break-inside: avoid; }
.mc-teeth td { border: 1px solid #000; width: 8.5mm; height: 6.5mm; text-align: center; font-size: 9pt; padding: 0; }
.mc-teeth td.mc-num { font-weight: bold; background: #f2f2f2; }
.mc-teeth td.mc-mid { border-left: 2.5px solid #000; }
.mc-teeth tr.mc-jaw td { border-bottom: 2.5px solid #000; }
.mc-legend { font-size: 8.5pt; text-align: center; margin: 0 0 6pt !important; }
.mc-sign { margin-top: 18pt !important; }
.mc-sub { font-size: 8.5pt; text-align: center; margin: 0 !important; }
.mc-break { page-break-before: always; break-before: page; margin: 0 !important; height: 0; }
`;

/** Browser-only rules (screen preview + printing); Word gets CARD_BASE_CSS only. */
export const CARD_CSS =
  CARD_BASE_CSS +
  `
@media screen { .mc-break { display: none; } }
@media print {
  @page { size: A4; margin: 14mm 14mm 14mm 18mm; }
  .mc-page { width: auto; min-height: 0; padding: 0; margin: 0; box-shadow: none; }
}
`;

type CardPatient = Pick<Patient, "first_name" | "last_name" | "phone" | "personal_id" | "date_of_birth">;

const BLANK = "________________________________";

function Val({ v, blank = BLANK }: { v?: string | null; blank?: string }) {
  return v ? <span className="mc-val">{v}</span> : <span className="mc-empty">{blank}</span>;
}

/** Ruled lines: the text split into lines, padded with empty lines up to `min`. */
function Lines({ text, min = 3 }: { text: string; min?: number }) {
  const lines = text ? text.split("\n") : [];
  while (lines.length < min) lines.push("");
  return (
    <>
      {lines.map((l, i) => (
        <p key={i} className="mc-line">
          {l || " "}
        </p>
      ))}
    </>
  );
}

function Box({ on }: { on: boolean }) {
  return <span className="mc-box">{on ? "☒" : "☐"}</span>;
}

function Options({ items, selected }: { items: string[]; selected: string[] }) {
  return (
    <table className="mc-opts">
      <tbody>
        {items.map((item) => (
          <tr key={item}>
            <td>{item}</td>
            <td className="mc-check">
              <Box on={selected.includes(item)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TwoColumns({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <table className="mc-opts">
      <tbody>
        <tr>
          <td style={{ width: "50%" }}>{left}</td>
          <td style={{ width: "50%" }}>{right}</td>
        </tr>
      </tbody>
    </table>
  );
}

function ToothRows({ upper, lower, teeth }: { upper: string[]; lower: string[]; teeth: Record<string, string> }) {
  const half = upper.length / 2;
  const cls = (i: number, base = "") => `${base}${i === half ? " mc-mid" : ""}`.trim() || undefined;
  return (
    <table className="mc-teeth">
      <tbody>
        <tr>
          {upper.map((t, i) => (
            <td key={t} className={cls(i, "mc-num")}>
              {t}
            </td>
          ))}
        </tr>
        <tr className="mc-jaw">
          {upper.map((t, i) => (
            <td key={t} className={cls(i)}>
              {teeth[t] ?? ""}
            </td>
          ))}
        </tr>
        <tr>
          {lower.map((t, i) => (
            <td key={t} className={cls(i)}>
              {teeth[t] ?? ""}
            </td>
          ))}
        </tr>
        <tr>
          {lower.map((t, i) => (
            <td key={t} className={cls(i, "mc-num")}>
              {t}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function AnnexHeader({ annex, form, provider }: { annex: string; form: string; provider: string }) {
  return (
    <>
      <p className="mc-annex">დანართი №{annex}</p>
      <p className="mc-provider">{provider}</p>
      <p className="mc-caption">სტომატოლოგიური მომსახურების მიმწოდებელი</p>
      <p className="mc-caption">პირის/დაწესებულების დასახელება</p>
      <p className="mc-form-no">ფორმა №{form}</p>
    </>
  );
}

export default function MedicalCardDocument({
  card,
  patient,
  cardNumber,
}: {
  card: MedicalCardData;
  patient: CardPatient;
  cardNumber: number | string | null;
}) {
  const hasPrimary = [...PRIMARY_UPPER, ...PRIMARY_LOWER].some((t) => card.teeth[t]);
  const diary = card.diary.length
    ? card.diary
    : Array.from({ length: 6 }, () => ({ date: "", text: "", doctor: "" }));

  return (
    <div className="mc-doc">
      {/* ===== Card ===== */}
      <div className="mc-page">
        <p className="mc-title">სტომატოლოგიური პაციენტის სამედიცინო ბარათი № {cardNumber ?? ". . . ."}</p>
        <p>
          გვარი, სახელი <Val v={`${patient.last_name} ${patient.first_name}`} />
        </p>
        <p>
          სქესი <Val v={card.sex} blank="______________________" />
        </p>
        <p>
          დაბადების თარიღი <Val v={formatDateShort(patient.date_of_birth).replace("—", "")} blank="____________________" />
          {"      "}ტელეფონი <Val v={patient.phone} blank="_________________" />
        </p>
        <p>
          პირადი ნომერი (ასეთის არსებობის შემთხვევაში) <Val v={patient.personal_id} />
        </p>
        <p>
          მისამართი <Val v={card.address} blank="__________________________________________________" />
        </p>
        <p>
          სამუშაო ადგილი <Val v={card.workplace} blank="____________________________________________" />
        </p>
        <p className="mc-section">ალერგია (მათ შორის – საანესთეზიო საშუალებებზე)</p>
        <Lines text={card.allergies} />
        <p className="mc-section">გადატანილი ან/და თანმხლები დაავადებები, მდგომარეობები:</p>
        <Lines text={card.diseases} />
        <p style={{ marginTop: "8pt" }}>
          სადაზღვევო პოლისის ნომერი (ასეთის არსებობის შემთხვევაში) <Val v={card.insurance_policy} blank="________________" />
        </p>
        <p>
          სადაზღვევო კომპანია (ასეთის არსებობის შემთხვევაში) <Val v={card.insurance_company} />
        </p>
      </div>

      {/* ===== Annex 2 — examination sheet ===== */}
      <p className="mc-break" />
      <div className="mc-page">
        <AnnexHeader annex="2" form="IV-220-1/ა" provider={card.provider} />
        <p className="mc-title">პაციენტის გასინჯვის ფურცელი</p>

        <table className="mc-table">
          <tbody>
            <tr>
              <td style={{ width: "50%" }}>
                <p>
                  თარიღი <Val v={formatDateShort(card.exam_date).replace("—", "")} blank="____________" />
                </p>
                <p className="mc-section" style={{ marginTop: 0 }}>
                  ჩივილები (მომართვის მიზეზი):
                </p>
                <p>
                  დაავადებული კბილ(ებ)ი <Val v={card.complaint_teeth} blank="____________" />
                </p>
                <Options items={COMPLAINTS_LEFT} selected={card.complaints} />
                <p>
                  სხვა <Val v={card.complaints_other} blank="______________________" />
                </p>
              </td>
              <td style={{ width: "50%" }}>
                <Options items={COMPLAINTS_RIGHT} selected={card.complaints} />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mc-section">ანამნეზი</p>
        <Lines text={card.anamnesis} min={4} />

        <p className="mc-section">ობიექტური გამოკვლევები</p>
        <p>პირის ღრუს დათვალიერება:</p>
        <ToothRows upper={TEETH_UPPER} lower={TEETH_LOWER} teeth={card.teeth} />
        {hasPrimary && <ToothRows upper={PRIMARY_UPPER} lower={PRIMARY_LOWER} teeth={card.teeth} />}
        <p className="mc-legend">{TOOTH_CODES.map((c) => `${c.code} – ${c.label}`).join(";  ")}</p>

        <p>
          თანკბილვა <Val v={card.occlusion} />
        </p>
        <p>
          პირის ღრუს ლორწოვანი გარსის მდგომარეობა: <Val v={card.mucosa} />
        </p>

        <p className="mc-section">პაროდონტის მდგომარეობა</p>
        <TwoColumns
          left={<Options items={PERIO_OPTIONS} selected={card.perio} />}
          right={
            <>
              <p style={{ margin: 0 }}>ნადები:</p>
              <Options items={PLAQUE_OPTIONS} selected={card.plaque} />
            </>
          }
        />
        <p>
          პაროდონტული ჯიბის სიღრმე <Val v={card.pocket_depth} blank="______________________" />
        </p>
        <p>
          სხვა <Val v={card.perio_other} />
        </p>

        <p className="mc-section">გამოკვლევის გეგმა:</p>
        <TwoColumns
          left={<Options items={PLAN_LEFT} selected={card.plan} />}
          right={
            <>
              <Options items={PLAN_RIGHT} selected={card.plan} />
              <p>
                სხვა <Val v={card.plan_other} blank="____________________" />
              </p>
            </>
          }
        />

        <p className="mc-section">კონსულტაცია/გამოკვლევის შედეგი:</p>
        <Lines text={card.result} min={3} />
        <p className="mc-section">საბოლოო დიაგნოზი (ICD-10)</p>
        <Lines text={card.diagnosis} min={2} />
        <p className="mc-section">მკურნალობა</p>
        <Lines text={card.treatment} min={4} />
        <p style={{ marginTop: "6pt" }}>
          მომდევნო ვიზიტი: <Val v={card.next_visit} blank="____________________" />
        </p>

        <table className="mc-table">
          <thead>
            <tr>
              <th style={{ width: "18%" }}>თარიღი</th>
              <th>ანამნეზი, სტატუსი, დიაგნოზი, ჩატარებული მკურნალობა, დანიშნულება</th>
              <th style={{ width: "22%" }}>მკურნალი ექიმი</th>
            </tr>
          </thead>
          <tbody>
            {diary.map((row, i) => (
              <tr key={i} style={{ height: "18pt" }}>
                <td>{formatDateShort(row.date).replace("—", "")}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{row.text}</td>
                <td>{row.doctor}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mc-section">მკურნალობის შედეგი (ეპიკრიზი)</p>
        <Lines text={card.epicrisis} min={4} />
        <p className="mc-section">რჩევა-დარიგება/დანიშნულება</p>
        <Lines text={card.advice} min={4} />
      </div>

      {/* ===== Annex 3 — informed consent ===== */}
      <p className="mc-break" />
      <div className="mc-page">
        <AnnexHeader annex="3" form="IV-220-2/ა" provider={card.provider} />
        <p className="mc-title" style={{ marginTop: "16pt" }}>
          პაციენტის წერილობითი ინფორმირებული თანხმობა სამედიცინო მომსახურების გაწევაზე
        </p>
        <p style={{ marginTop: "10pt" }}>
          მე <Val v={card.consent_patient || `${patient.first_name} ${patient.last_name}`} />
        </p>
        <p className="mc-sub">(სახელი, გვარი)</p>
        <p style={{ marginTop: "10pt", textAlign: "justify" }}>
          მივიღე ინფორმაცია სამედიცინო მომსახურების გაწევის შესახებ. მკურნალმა ექიმმა გამაცნო სამედიცინო
          მომსახურების მიზანი, მისი მიმდინარეობა, თავისებურებანი და შესაძლო გართულებები. ასევე ჩემთვის ცნობილია
          სამედიცინო მომსახურებაზე უარის შემთხვევაში დამდგარი შედეგის შესახებ.
        </p>
        <p className="mc-sign">
          პაციენტის (ან პაციენტის კანონიერი წარმომადგენლის) ხელმოწერა _______________________
        </p>
        <p className="mc-sign">
          მე, ექიმი <Val v={card.consent_doctor} />
        </p>
        <p className="mc-sub">(სახელი, გვარი)</p>
        <p style={{ marginTop: "10pt", textAlign: "justify" }}>
          ვადასტურებ, რომ პაციენტს პასუხი გაეცა ყველა შეკითხვაზე, რაც შეეხება მის ჯანმრთელობას, დაავადებას,
          მკურნალობას. ასევე მიიღო პასუხი მკურნალობის ალტერნატიულ მეთოდებზე და მის ღირებულებაზე.
        </p>
        <p className="mc-sign">ხელმოწერა _________________</p>
        <p style={{ textAlign: "right", marginTop: "12pt" }}>
          თარიღი <Val v={formatDateShort(card.consent_date).replace("—", "")} blank="„____“ ____________ 20___" />
        </p>
      </div>
    </div>
  );
}
