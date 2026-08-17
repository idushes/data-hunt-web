import Script from "next/script";

import { GOOGLE_ADS_TAG_ID } from "./googleAdsConversion";

export default function GoogleAdsTag() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`}
        strategy="afterInteractive"
      />
      <Script id="datahunt-google-ads-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ADS_TAG_ID}', {
            allow_ad_personalization_signals: false,
            restricted_data_processing: true
          });
        `}
      </Script>
    </>
  );
}
