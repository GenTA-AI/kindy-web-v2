import { businessInfo, businessInfoRows, isBusinessInfoComplete } from '@/lib/business-info';

export default function BusinessPage() {
  const rows = businessInfoRows();
  const complete = isBusinessInfoComplete();

  return (
    <article className="pb-12 text-sm font-medium leading-relaxed text-ink2">
      <h1 className="mb-6 text-2xl font-extrabold leading-tight text-ink">사업자정보확인</h1>
      <p className="mt-2">
        Kindy 서비스 운영자와 고객센터 정보를 안내합니다. 결제, 환불, 개인정보 문의가 필요할 때
        아래 연락처로 확인할 수 있어요.
      </p>

      {!complete && (
        <section className="mt-6 rounded-3xl border border-line bg-mist p-5">
          <h2 className="text-base font-black text-ink">정보 확인 안내</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
            화면에 표시되지 않는 항목은 고객센터로 문의해 주세요. 유료 결제 단계에서는 판매자와
            결제 조건을 다시 확인한 뒤 진행합니다.
          </p>
        </section>
      )}

      <dl className="mt-6 divide-y divide-line rounded-3xl border border-line bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-3">
            <dt className="text-xs font-black text-sage">{label}</dt>
            <dd className="min-w-0 break-words text-sm font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="text-lg font-black text-ink">고객 문의</h2>
        <p className="mt-2">
          서비스 이용, 결제, 환불, 개인정보 문의는{' '}
          <a className="font-bold text-saged underline underline-offset-2" href={`mailto:${businessInfo.email}`}>
            {businessInfo.email}
          </a>
          로 연락해주세요.
        </p>
      </section>
    </article>
  );
}
