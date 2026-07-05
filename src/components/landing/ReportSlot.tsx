import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Image from 'next/image';

const REPORT_SAMPLE_PATH = '/landing/report-sample.png';

export default function ReportSlot() {
  const reportImagePath = join(process.cwd(), 'public', 'landing', 'report-sample.png');
  const hasReportImage = existsSync(reportImagePath);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_22px_60px_-42px_rgba(35,49,38,.55)]">
      <div className="border-b border-line bg-mist px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">보호자 기록</p>
        <p className="mt-1 text-base font-black text-ink">한 편을 본 뒤 남는 실제 화면</p>
      </div>
      {hasReportImage ? (
        <Image
          src={REPORT_SAMPLE_PATH}
          alt="아이별 보호자 기록 예시"
          width={750}
          height={1334}
          priority
          className="h-auto w-full"
        />
      ) : (
        <div className="flex min-h-[420px] flex-col justify-between bg-cream p-5 sm:min-h-[520px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-sm font-black text-ink">오늘의 이야기</p>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-ink2">
                아이가 다시 본 장면과 오래 머문 놀이가 이 자리에 남습니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['다시 본 장면', '끝낸 놀이', '집에서 나눌 말', '다음 이야기'].map((label) => (
                <div key={label} className="min-h-24 rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs font-black text-sage">{label}</p>
                  <div className="mt-5 h-2 rounded-full bg-sagebg" />
                  <div className="mt-2 h-2 w-2/3 rounded-full bg-mist" />
                </div>
              ))}
            </div>
          </div>
          <p className="rounded-2xl border border-dashed border-sage bg-white px-4 py-3 text-xs font-bold leading-relaxed text-ink2">
            실물 리포트 캡처 파일이 들어오면 이 슬롯에 그대로 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
