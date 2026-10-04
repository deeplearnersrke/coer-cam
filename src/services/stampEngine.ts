export async function generateStampedImage(
  input: StampInputData
): Promise<{ blob: Blob; dataUrl: string }> {
  const {
    imageSrc,
    event,
    photoNumber,
    location,
    timestamp,
    stampStyle = 'gps_classic',
    settings,
  } = input;

  const baseImg = await loadImage(imageSrc);

  /*
   * FIXED OUTPUT
   *
   * Every photo is always 1600 x 1200.
   */
  const OUTPUT_WIDTH = 1600;
  const OUTPUT_HEIGHT = 1200;

  const canvas = document.createElement('canvas');

  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  /*
   * Draw the already-normalized image.
   *
   * The image coming from useCamera is already
   * 1600x1200, so there is no orientation logic here.
   */
  ctx.drawImage(
    baseImg,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT
  );

  /*
   * Fixed scaling.
   */
  const scale = OUTPUT_WIDTH / 1200;

  const pad = Math.round(20 * scale);
  const cornerRadius = Math.round(12 * scale);

  /*
   * Field values.
   */
  const schoolName =
    event?.schoolName ||
    settings?.schoolName ||
    input.customSchoolName ||
    'INSTITUTION DOCUMENTATION';

  const eventName = event?.name || '';
  const department = event?.department || '';
  const organizer = event?.organizer || '';
  const locationName = event?.locationName || '';
  const remarks =
    event?.remarks ||
    input.customRemarks ||
    '';

  const logoUrl =
    event?.logoDataUrl ||
    settings?.logoDataUrl ||
    '';

  const dateStr =
    formatOfficialDate(timestamp);

  const timeStr =
    formatOfficialTime(timestamp);

  const hasCoords =
    location.latitude !== 0 ||
    location.longitude !== 0;

  const latStr = hasCoords
    ? formatLatDegrees(location.latitude)
    : '';

  const lonStr = hasCoords
    ? formatLonDegrees(location.longitude)
    : '';

  const accStr =
    location.accuracy &&
    location.accuracy < 900
      ? `±${Math.round(location.accuracy)} m`
      : '';

  const altStr =
    location.altitude
      ? `${Math.round(location.altitude)} m`
      : '';

  /*
   * Build the same items your existing stamp engine uses.
   */
  const items: KeyVal[] = [
    {
      label: 'Photo No.',
      value: photoNumber,
    },
    {
      label: 'Date',
      value: dateStr,
    },
    {
      label: 'Time',
      value: timeStr,
    },
    ...(department
      ? [
          {
            label: 'Department',
            value: department,
          },
        ]
      : []),
    ...(organizer
      ? [
          {
            label: 'Organizer',
            value: organizer,
          },
        ]
      : []),
    ...(locationName
      ? [
          {
            label: 'Location',
            value: locationName,
          },
        ]
      : []),
    ...(latStr
      ? [
          {
            label: 'Latitude',
            value: latStr,
          },
        ]
      : []),
    ...(lonStr
      ? [
          {
            label: 'Longitude',
            value: lonStr,
          },
        ]
      : []),
    ...(accStr
      ? [
          {
            label: 'Accuracy',
            value: accStr,
          },
        ]
      : []),
    ...(altStr
      ? [
          {
            label: 'Altitude',
            value: altStr,
          },
        ]
      : []),
    ...(remarks
      ? [
          {
            label: 'Remarks',
            value: remarks,
          },
        ]
      : []),
  ];

  /*
   * QR
   */
  let qrImg: HTMLImageElement | null = null;

  if (stampStyle === 'gps_qr' || stampStyle === 'gps_classic') {
    const qrText = [
      photoNumber,
      schoolName,
      eventName,
      dateStr,
      timeStr,
      latStr,
      lonStr,
    ]
      .filter(Boolean)
      .join(' | ');

    const qrData =
      await generateQrDataUrl(qrText);

    if (qrData) {
      try {
        qrImg = await loadImage(qrData);
      } catch {
        qrImg = null;
      }
    }
  }

  /*
   * Logo.
   */
  let logoImg: HTMLImageElement | null = null;

  if (logoUrl) {
    try {
      logoImg = await loadImage(logoUrl);
    } catch {
      logoImg = null;
    }
  }

  /*
   * --------------------------------------------------
   * FIXED BOTTOM STAMP
   * --------------------------------------------------
   *
   * There is NO landscape/portrait condition.
   */
  const panelWidth = Math.min(
    canvas.width - pad * 2,
    Math.round(620 * scale)
  );

  const panelX = pad;

  const effectivePad = pad;

  const headerFontSize = 18;
  const subHeaderFontSize = 15;
  const labelFontSize = 13;
  const valueFontSize = 13;

  const panelFontHeader =
    `600 ${Math.round(
      headerFontSize * scale
    )}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  const panelFontSubHeader =
    `500 ${Math.round(
      subHeaderFontSize * scale
    )}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  const panelFontLabel =
    `500 ${Math.round(
      labelFontSize * scale
    )}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  const panelFontValue =
    `400 ${Math.round(
      valueFontSize * scale
    )}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  /*
   * Label width.
   */
  ctx.font = panelFontLabel;

  let maxLabelWidth = 0;

  items.forEach(item => {
    const width =
      ctx.measureText(
        `${item.label} : `
      ).width;

    if (width > maxLabelWidth) {
      maxLabelWidth = width;
    }
  });

  const qrReserve = qrImg
    ? Math.round(80 * scale)
    : 0;

  const valueAvailWidth =
    Math.max(
      Math.round(80 * scale),
      panelWidth -
        effectivePad * 2 -
        maxLabelWidth -
        qrReserve
    );

  /*
   * Header wrapping.
   */
  ctx.font = panelFontHeader;

  const headerLines = wrapText(
    ctx,
    schoolName,
    panelWidth -
      effectivePad * 2 -
      (logoImg
        ? Math.round(50 * scale)
        : 0)
  );

  /*
   * Event name.
   */
  ctx.font = panelFontSubHeader;

  const subHeaderLines = wrapText(
    ctx,
    eventName,
    panelWidth -
      effectivePad * 2
  );

  /*
   * Process values.
   */
  ctx.font = panelFontValue;

  const processedItems: {
    label: string;
    valLines: string[];
  }[] = [];

  items.forEach(item => {
    const valLines = wrapText(
      ctx,
      item.value,
      valueAvailWidth
    );

    processedItems.push({
      label: item.label,
      valLines: valLines.length
        ? valLines
        : [''],
    });
  });

  /*
   * Fixed typography.
   */
  const headerLineH =
    Math.round(24 * scale);

  const subHeaderLineH =
    Math.round(20 * scale);

  const itemLineH =
    Math.round(18 * scale);

  const itemGap =
    Math.round(3 * scale);

  /*
   * Calculate panel height.
   */
  let totalContentH =
    effectivePad * 2;

  totalContentH +=
    headerLines.length *
    headerLineH;

  if (subHeaderLines.length > 0) {
    totalContentH +=
      subHeaderLines.length *
        subHeaderLineH +
      Math.round(3 * scale);
  }

  totalContentH +=
    Math.round(12 * scale);

  processedItems.forEach(pi => {
    totalContentH +=
      Math.max(
        1,
        pi.valLines.length
      ) *
        itemLineH +
      itemGap;
  });

  const qrSize = qrImg
    ? Math.round(72 * scale)
    : 0;

  if (qrImg) {
    totalContentH +=
      qrSize +
      Math.round(4 * scale);
  }

  const panelHeight = Math.min(
    totalContentH,
    canvas.height - pad * 2
  );

  /*
   * ALWAYS BOTTOM.
   */
  const panelY =
    canvas.height -
    panelHeight -
    pad;

  /*
   * Panel background.
   */
  ctx.save();

  ctx.fillStyle =
    'rgba(0, 0, 0, 0.75)';

  drawRoundedRect(
    ctx,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    cornerRadius
  );

  ctx.fill();

  /*
   * Border.
   */
  ctx.strokeStyle =
    'rgba(255, 255, 255, 0.15)';

  ctx.lineWidth =
    Math.max(
      1,
      Math.round(1 * scale)
    );

  ctx.stroke();

  /*
   * Content position.
   */
  let curY =
    panelY +
    effectivePad +
    Math.round(14 * scale);

  const curX =
    panelX + effectivePad;

  /*
   * Logo.
   */
  if (logoImg) {
    const logoSize =
      Math.round(48 * scale);

    ctx.drawImage(
      logoImg,
      panelX +
        panelWidth -
        effectivePad -
        logoSize,
      panelY +
        effectivePad,
      logoSize,
      logoSize
    );
  }

  /*
   * Heading.
   */
  ctx.fillStyle = '#FFFFFF';
  ctx.font = panelFontHeader;

  headerLines.forEach(line => {
    ctx.fillText(
      line,
      curX,
      curY
    );

    curY += headerLineH;
  });

  /*
   * Event name.
   */
  if (subHeaderLines.length > 0) {
    ctx.fillStyle = '#E2E8F0';
    ctx.font = panelFontSubHeader;

    subHeaderLines.forEach(line => {
      ctx.fillText(
        line,
        curX,
        curY
      );

      curY +=
        subHeaderLineH;
    });
  }

  /*
   * Divider.
   */
  curY +=
    Math.round(4 * scale);

  ctx.fillStyle =
    'rgba(255, 255, 255, 0.2)';

  ctx.fillRect(
    curX,
    curY,
    panelWidth -
      effectivePad * 2,
    Math.max(
      1,
      Math.round(1 * scale)
    )
  );

  curY +=
    Math.round(12 * scale);

  /*
   * Key/value fields.
   */
  processedItems.forEach(pi => {
    const labelText =
      pi.label;

    ctx.fillStyle = '#CBD5E1';
    ctx.font = panelFontLabel;

    ctx.fillText(
      labelText,
      curX,
      curY
    );

    const colonX =
      curX +
      maxLabelWidth -
      Math.round(10 * scale);

    ctx.fillText(
      ':',
      colonX,
      curY
    );

    const valX =
      curX + maxLabelWidth;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = panelFontValue;

    pi.valLines.forEach(
      (valLine, index) => {
        ctx.fillText(
          valLine,
          valX,
          curY +
            index * itemLineH
        );
      }
    );

    curY +=
      Math.max(
        1,
        pi.valLines.length
      ) *
        itemLineH +
      itemGap;
  });

  /*
   * QR code.
   */
  if (qrImg) {
    const qrX =
      panelX +
      panelWidth -
      effectivePad -
      qrSize;

    const qrY =
      panelY +
      panelHeight -
      effectivePad -
      qrSize;

    ctx.drawImage(
      qrImg,
      qrX,
      qrY,
      qrSize,
      qrSize
    );
  }

  ctx.restore();

  /*
   * Final output remains 1600x1200.
   */
  const quality =
    settings?.imageQuality || 0.95;

  const dataUrl =
    canvas.toDataURL(
      'image/jpeg',
      quality
    );

  const blob =
    await new Promise<Blob>(resolve => {
      canvas.toBlob(
        b =>
          resolve(
            b ||
              new Blob(
                [],
                {
                  type: 'image/jpeg',
                }
              )
          ),
        'image/jpeg',
        quality
      );
    });

  return {
    blob,
    dataUrl,
  };
}