// Samples here are fictional on purpose (555-01xx numbers, example domains, made-up streets).
// This file is excluded from the repository scan for that reason.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  describeImageMetadata,
  exifHasGps,
  findAddresses,
  findEmails,
  findPhones,
  findSection15Terms,
  isPublishableVideoTitle,
  isPublishableText,
  lineOf,
  mask,
  normalizeForScan,
  stripLicenseComments,
} from '../../scripts/lib/privacy-rules.ts';

describe('phone numbers', () => {
  it('finds common formats', () => {
    expect(findPhones('Call (212) 555-2368 today')).toHaveLength(1);
    expect(findPhones('tel: +1 212.555.2368')).not.toHaveLength(0);
    expect(findPhones('手机 13800138000')).toHaveLength(1);
    expect(findPhones('<a href="tel:+12125552368">')).not.toHaveLength(0);
  });

  it('allows the 555-0100–0199 range reserved for fiction', () => {
    expect(findPhones('(212) 555-0123')).toHaveLength(0);
  });

  it('ignores numbers that are not phone numbers', () => {
    const text =
      'NSF CAREER #1942937; pp. 160–169; 395-404; 2026-11-20; N = 24; 1,130 units; r = .34; COP 3530; 0.11 points; 2018–21';
    expect(findPhones(text)).toEqual([]);
  });
});

describe('email addresses', () => {
  it('flags unexpected addresses', () => {
    expect(findEmails('write to jane.doe@university.edu')).toHaveLength(1);
  });

  it('allows the chosen public address, reserved domains and noreply addresses', () => {
    expect(findEmails('me@university.edu', ['me@university.edu'])).toHaveLength(0);
    expect(findEmails('someone@example.com, x@site.test')).toHaveLength(0);
    expect(findEmails('42618679+someone@users.noreply.github.com')).toHaveLength(0);
  });

  it('ignores retina image names and package scopes', () => {
    expect(findEmails('logo@2x.png and @fontsource/inter and @astrojs/react')).toHaveLength(0);
  });
});

describe('street addresses', () => {
  it('flags street lines, unit numbers and state + ZIP', () => {
    expect(findAddresses('1234 NW Example Street')).toHaveLength(1);
    expect(findAddresses('Apt 4B')).toHaveLength(1);
    expect(findAddresses('Gainesville, FL 32601')).toHaveLength(1);
  });

  it('ignores ordinary text with numbers', () => {
    expect(findAddresses('Study 2 had 77 initial participants; 32 retained.')).toEqual([]);
    expect(findAddresses('Gainesville, Florida')).toEqual([]);
  });
});

describe('facts.md §15 terms', () => {
  it('flags the categories', () => {
    const cases = [
      'my GPA was high',
      'visa status',
      'work authorization',
      'OPT extension',
      'my daughter loves this',
      'salary expectations',
      'job search update',
      'willing to relocate',
      'cited by 120',
      '我的女儿',
    ];
    for (const text of cases) expect(findSection15Terms(text), text).not.toHaveLength(0);
  });

  it('flags the retired dissertation framing (facts.md §5.1)', () => {
    expect(findSection15Terms('a decision matrix')).toHaveLength(1);
    expect(findSection15Terms('18% name-only')).toHaveLength(1);
  });

  it('does not flag ordinary research language', () => {
    const text =
      'F1 score; the opt-in consent; Dr. Lucky Dad channel; interest development Phase; 29% said nothing beyond the name; Optical engineering';
    expect(findSection15Terms(text)).toEqual([]);
  });

  it('gates fetched titles', () => {
    expect(isPublishableText('Testing a parenting tip')).toBe(true);
    expect(isPublishableText('My son tries the tip')).toBe(false);
  });
});

describe('image metadata', () => {
  it('detects GPS in EXIF written by a camera-like pipeline', async () => {
    const withGps = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#888' },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: 'Fixture' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '29/1 38/1 0/1' },
      })
      .toBuffer();
    const meta = await sharp(withGps).metadata();
    expect(meta.exif && exifHasGps(meta.exif)).toBe(true);
    expect(describeImageMetadata(meta).hasLocation).toBe(true);
  });

  it('passes EXIF without location, and images without metadata', async () => {
    const noGps = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'Fixture' } })
      .toBuffer();
    const meta = await sharp(noGps).metadata();
    expect(describeImageMetadata(meta)).toMatchObject({ hasExif: true, hasLocation: false });

    const bare = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } })
      .webp()
      .toBuffer();
    expect(describeImageMetadata(await sharp(bare).metadata())).toMatchObject({
      hasExif: false,
      hasLocation: false,
    });
  });
});

describe('helpers', () => {
  it('finds line numbers and masks matches for public logs', () => {
    expect(lineOf('a\nb\nc', 4)).toBe(3);
    expect(mask('jane.doe@university.edu')).toBe('jane…du');
  });
});

describe('formats found in review (fictional digits)', () => {
  it('finds grouped and prefixed Chinese mobiles, landlines and compact international numbers', () => {
    const cases = [
      '138 0013 8000',
      '138-0013-8000',
      '手机：138-0013-8000',
      '+8613800138000',
      '+86-13800138000',
      '(+86) 138 0013 8000',
      '0086 138 0013 8000',
      '010-12345678',
      '(212)555-2368',
      '212/555-2368',
      '+44 7700 900123',
      '+12125552368',
      'phone: 2125552368',
    ];
    for (const text of cases) expect(findPhones(`x ${text} y`), text).not.toHaveLength(0);
  });

  it('finds Chinese street addresses', () => {
    expect(findAddresses('地址：某某市某某区示例路100号')).toHaveLength(1);
  });

  it('does not flag ordinary research phrasing', () => {
    const text = [
      'We ran semi-structured interviews with older adults.',
      'I conducted interviews with teachers.',
      'The code is available from GitHub.',
      'Participants received compensation for their time.',
      'Students and their parents took part.',
      'Our design framework and flood prototype.',
      'Wearable baby thermometer',
    ].join(' ');
    expect(findSection15Terms(text)).toEqual([]);
  });

  it('still flags job-search and availability statements', () => {
    expect(findSection15Terms('I interviewed at Google')).not.toHaveLength(0);
    expect(findSection15Terms('Available from January 2027')).not.toHaveLength(0);
    expect(findSection15Terms('willing to relocate')).not.toHaveLength(0);
  });
});

describe('fetched text (D54)', () => {
  it('holds back titles that mention a child or partner in any common form', () => {
    const titles = [
      'Testing the bedtime rule with our toddler',
      'Our daughter vs. the screen-time rule',
      'My 3-year-old tries the first-then trick',
      'My little one and the marshmallow test',
      'Dad tests a parenting tip on his son',
      'Does white noise help a newborn sleep?',
      '我家宝宝的第一个机器人',
      '女儿的睡前规则',
    ];
    for (const title of titles) expect(isPublishableVideoTitle(title), title).toBe(false);
  });

  it('shows titles about the advice itself', () => {
    expect(isPublishableVideoTitle('Testing a common parenting tip at home')).toBe(true);
    expect(isPublishableVideoTitle('Does white noise really help sleep?')).toBe(true);
  });
});

describe('PNG raw metadata profiles', () => {
  it('counts an ImageMagick-style "Raw profile type exif" text chunk as metadata', () => {
    const report = describeImageMetadata({
      comments: [{ keyword: 'Raw profile type exif', text: '\nexif\n 20\n45786966…\n' }],
    });
    expect(report.hasMetadata).toBe(true);
    expect(
      describeImageMetadata({ comments: [{ keyword: 'Comment', text: 'x' }] }).hasMetadata,
    ).toBe(false);
  });

  it('masks matches on one line', () => {
    expect(mask('tel:+1 212 555 2368\n')).not.toContain('\n');
  });
});

describe('second review: real cases and false positives', () => {
  it('catches job-search, availability and family phrasing that matters', () => {
    const cases = [
      'I will require sponsorship to work in the US.',
      'I can relocate for the right role.',
      'I am relocating to Seattle next spring.',
      'Start date: June 2027',
      'I had an on-site interview at the University of Washington.',
      'Interviewed with the search committee at Georgia Tech',
      'Expected compensation: negotiable',
      'We are expecting our second child.',
      '我们家的周末',
    ];
    for (const text of cases) expect(findSection15Terms(text), text).not.toHaveLength(0);
  });

  it('catches dashes, dots and full-width digits in phone numbers', () => {
    for (const text of [
      'Call 212–555–2368',
      '212‑555‑2368',
      '138.0013.8000',
      '１３８００１３８０００',
      '(010) 6275 1234',
    ]) {
      expect(findPhones(text), text).not.toHaveLength(0);
    }
  });

  it('leaves minified code, counts and IDs alone', () => {
    const text = [
      '(16777215&e)+6777216*(n=',
      '(b^-1)+2147483631',
      'STACK_SIZE="+65536+"',
      '+23.45 points',
      'Context window grew +4096 tokens',
      '知乎 +3000 赞同',
      'UTC +8 2026-11-19 20:00',
      'https://www.zhihu.com/question/1234567890/answer/9876543210',
      'The corpus has 15000000000 tokens',
      '16 GiB = 17179869184 bytes',
      '/actions/runs/17345678901',
      '这部手机2019-2023年一直在用',
      '我用的是微信 3.9.12.51（Windows 版）',
    ].join('\n');
    expect(findPhones(text)).toEqual([]);
  });

  it('leaves Chinese school and everyday wording alone', () => {
    const text =
      '人教版三年级上册第4单元的生字；我写了第3单元测试；实验室在5号楼；电路2号板；这条路19号就通车了；在中山路2号出口见；我家乡的中学';
    expect([...findAddresses(text), ...findSection15Terms(text)]).toEqual([]);
    expect(findAddresses('5号楼302室')).toHaveLength(1);
    expect(findAddresses('北京市海淀区中关村大街27号')).toHaveLength(1);
  });

  it('leaves research and product language alone', () => {
    const text = [
      'I redesigned our baby thermometer’s enclosure.',
      'Our partner agency shared flood reports.',
      'We ran interviews with Jacksonville residents.',
      'The dataset will be available starting in December 2026.',
      'Each answer lists up to 3 citations to pages on this site.',
      'Participant identities were removed.',
      'Error diagnosis for LLM agents; OPT-175B; continued pre-training (CPT).',
      'Payments go through Visa.',
      'Since 2016 Google Drive has been my lab notebook. Unit 3: Usability testing. IRB ID 20231.',
    ].join(' ');
    expect([...findSection15Terms(text), ...findAddresses(text)]).toEqual([]);
  });

  it('ignores library authors in license comments of bundled code', () => {
    const code =
      '/*! lib v1 | (c) Jane Doe <jane.doe@university.edu> */\n// Copyright 2020 by A. Person (a.person@university.edu)\nvar x=1;';
    expect(findEmails(stripLicenseComments(code))).toEqual([]);
    expect(findEmails('var contact="jane.doe@university.edu";')).toHaveLength(1);
  });

  it('holds back video titles that mention children in any common form', () => {
    for (const title of [
      'Teaching my 5yo to ride a bike',
      'Our 18mo learns sign language',
      'Big sister helps',
      '大宝第一天上幼儿园',
      '带小朋友去海边',
    ]) {
      expect(isPublishableVideoTitle(title), title).toBe(false);
    }
  });

  it('keeps research repositories (repository names use the page-text rules only)', () => {
    expect(isPublishableText('JimmyRaoUF/urban-digital-twins')).toBe(true);
    expect(isPublishableText('Child process pool for the LLM pipeline')).toBe(true);
  });
});

describe('third review: regressions and gaps', () => {
  const all = (text: string) => [
    ...findPhones(text),
    ...findAddresses(text),
    ...findSection15Terms(text),
  ];

  it('finds numbers after en or em dashes and a slash label', () => {
    for (const text of ['联系我——13800138000', 'Phone—212-555-2368', '手机/13800138000']) {
      expect(findPhones(text), text).not.toHaveLength(0);
    }
  });

  it('finds street lines with year-like house numbers and state + ZIP without a comma', () => {
    for (const text of [
      '2015 SW 16th Ave',
      '2000 SW Archer Rd',
      '1950 Oak Street',
      '5 SW Main St',
      'Gainesville FL 32611',
      '地址：某某小区5号楼',
    ]) {
      expect(findAddresses(text), text).not.toHaveLength(0);
    }
  });

  it('finds §15 phrasing in English and Chinese', () => {
    for (const text of [
      'Available immediately',
      'I am available starting in June 2027',
      'Status: available from June 2027',
      'Availability: immediately',
      'I interviewed with Google',
      'interviews with Meta',
      '1,234 citations',
      '500+ citations',
      'I live with my partner',
      'Compensation: negotiable',
      'a salary of $90,000',
      'GPA3.9',
      'H1-B',
      'NIW',
      'I-140',
      'Visa delays',
      'seeking faculty positions starting Fall 2027',
      'Open to full-time roles from Summer 2027',
      '我太太',
      '我爱人',
      '我先生',
      '我媳妇',
      '我妈',
      '我爸',
      '签证',
      '绿卡',
      '年薪30万',
      '期望薪资',
      '求职',
      '找工作',
      '秋招',
    ]) {
      expect(findSection15Terms(text), text).not.toHaveLength(0);
    }
  });

  it('leaves research, talk and Chinese everyday wording alone', () => {
    for (const text of [
      'semi-structured phone interviews',
      'Faculty interviews revealed three themes.',
      'Participants were interviewed at the Alachua County Library.',
      'We evaluated on OPT-175B.',
      'Data availability: the data are on OSF.',
      "I'll be available at the poster session.",
      'Study start date: March 2024',
      'Participants received compensation: $20',
      'The dataset will be available from June 2027.',
      'We interviewed at three schools.',
      'Interviews with Older Adults',
      'my interview study with teachers',
      'my partner school',
      'up to 3 citations',
      'looking for the positions of the landmarks',
      'seeking the positions of the hands',
      '原文地址：知乎，2024年10月27号发布',
      '直播地址：B站，11月3号',
      '我爱人工智能',
      '我的妈呀',
      '我先生成一个列表',
      '数字移民',
    ]) {
      expect(all(text), text).toEqual([]);
    }
  });

  it('leaves decimals, coordinates and title-case phrases alone', () => {
    for (const text of [
      'range 0.001-1000000',
      'C 100.5 200.25 312.512 1024.75',
      'translate(256.000 1024.5)',
      'Table 2 One Way ANOVA',
      'Table 12 One Way ANOVA',
      'the 2 Supreme Court cases',
      'Team 1 First Place',
      'We won 12 First Place ribbons',
      'UF Hackathon 2024 Second Place',
      'Study ID 20231',
    ]) {
      expect(all(text), text).toEqual([]);
    }
  });

  it('holds back more family titles', () => {
    for (const title of [
      '奶爸带娃',
      '宝妈日常',
      '育儿技巧',
      'Family vlog',
      'Lily (age 3) learns to swim',
    ]) {
      expect(isPublishableVideoTitle(title), title).toBe(false);
    }
  });

  it('reports positions that match the normalized text, so line numbers stay right', () => {
    const text = `${'他说……我想……然后……\n'.repeat(60)}\n\nCall 212 555 2368`;
    const normalized = normalizeForScan(text);
    const [phone] = findPhones(normalized);
    expect(phone && lineOf(normalized, phone.index)).toBe(63);
  });
});

describe('sixth review: the owner view reports whole words', () => {
  // The owner's names, built at run time like the corpus does.
  const owner = 'Jim' + 'my';
  const given = 'Nan' + 'jie';
  const surname = 'Ra' + 'o';
  const matches = (text: string) => findSection15Terms(text).map((f) => [f.index, f.match]);

  it('maps a rewritten match back to the words it came from', () => {
    expect(matches(`${owner} has asthma.`)).toEqual([[0, `${owner} has asthma`]]);
    expect(matches(`${owner} and his wife moved here.`)).toEqual([[owner.length + 5, 'his wife']]);
    expect(matches(`${owner}\nhas two kids.`)).toEqual([[0, `${owner}\nhas two kids`]]);
    expect(matches(`${given}\n${surname} is married.`)).toEqual([
      [0, `${given}\n${surname} is married`],
    ]);
  });

  it('reads answers in CRLF YAML, doubled apostrophes and JSON escapes', () => {
    const crlf =
      'items:\r\n  - q: "Family?"\r\n    a: >-\r\n      Outside the lab,\r\n      He is married.\r\n';
    expect(matches(crlf).map(([, m]) => m)).toEqual(['He is married']);
    expect(matches("- q: 'x'\n  a: 'He''s married.'").map(([, m]) => m)).toEqual(["He''s married"]);
    expect(matches('{"q":"x","a":"Line one.\\nHe is married."}').map(([, m]) => m)).toEqual([
      'He is married',
    ]);
  });
});
