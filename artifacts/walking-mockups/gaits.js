/* Mockup-only, deterministic walking poses. Parts are ordered tail to head. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var clamp = function (value, low, high) {
    return Math.max(low, Math.min(high, value));
  };

  var metadata = {
    feet: {
      title: 'Gentle crawl',
      description: 'A footless body ripple, with a quiet reveal at each letter.',
    },
    inch: {
      title: 'Inchworm',
      description: 'A soft stretch-and-gather walk, followed by a gentle pixel wash.',
    },
    guide: {
      title: 'Row-by-row guide',
      description: 'A cheerful four-foot march along the edge, revealing one row at a time.',
    },
  };

  function part(forward, side, scaleX, scaleY, amount) {
    return {
      forward: forward * amount,
      side: side * amount,
      scaleX: 1 + (scaleX - 1) * amount,
      scaleY: 1 + (scaleY - 1) * amount,
    };
  }

  // Each pair alternates its planted and lifted foot. The smooth half-wave
  // makes contact gradual, so a 60 Hz frame boundary never changes the pose.
  function footPair(partIndex, phase, stride, reach, lift, amount) {
    return [-1, 1].map(function (side) {
      var footPhase = phase + (side === 1 ? Math.PI : 0);
      var swing = Math.sin(footPhase);
      var raised = Math.pow((1 + Math.cos(footPhase)) / 2, 2);
      return {
        part: partIndex,
        forward: stride * swing * amount,
        side: side * (reach - lift * raised * amount),
        angle: side * (15 + 26 * swing) * amount,
        opacity: amount,
      };
    });
  }

  function littleFeet(time, amount) {
    var phase = time * TAU * 1.65;
    var parts = [];
    var feet = [];
    for (var index = 0; index < 5; index += 1) {
      // The small phase lag reads as a flexible body without a separate
      // travelling sine-wave path or a rotation on every body square.
      var lag = index * 0.47;
      parts.push(part(
        0.32 * Math.sin(phase - lag),
        0.85 * Math.sin(phase * 2 - lag),
        1 + 0.018 * Math.cos(phase * 2 - lag),
        1 - 0.018 * Math.cos(phase * 2 - lag),
        amount
      ));
      if (index > 0 && index < 4) {
        feet = feet.concat(footPair(index, phase + index * Math.PI, 2.7, 7.6, 1.8, amount));
      }
    }
    return { parts: parts, feet: [] };
  }

  function inchworm(time, amount) {
    var phase = time * TAU * 1.12;
    var gather = (1 - Math.cos(phase)) / 2;
    var release = Math.sin(phase);
    // Tail and head take turns reaching. The middle lifts as the body gathers;
    // its end parts stay almost level to suggest alternating planted contacts.
    return {
      parts: [
        part(7.2 * gather - 2.2 * release, -0.45 * gather, 1 + 0.05 * release, 1, amount),
        part(4.2 * gather - 1.3 * release, -3.5 * gather, 1 - 0.07 * gather, 1 + 0.04 * gather, amount),
        part(0.6 * release, -6.0 * gather, 1 - 0.11 * gather, 1 + 0.08 * gather, amount),
        part(-3.4 * gather + 1.3 * release, -3.5 * gather, 1 - 0.07 * gather, 1 + 0.04 * gather, amount),
        part(2.8 * release, -0.35 * gather, 1 + 0.025 * release, 1 - 0.025 * release, amount),
      ],
      feet: [],
    };
  }

  function rowGuide(time, amount) {
    var phase = time * TAU * 1.42;
    var parts = [];
    for (var index = 0; index < 5; index += 1) {
      var lag = index * 0.22;
      var bounce = Math.cos(phase * 2 - lag);
      // Soft, twice-per-stride bounce. Squash is strongest at contact and
      // remains restrained enough that the life-meter squares stay familiar.
      parts.push(part(
        0.8 * Math.sin(phase - lag),
        -1.15 + 1.15 * bounce,
        1 + 0.055 * bounce,
        1 - 0.055 * bounce,
        amount
      ));
    }
    return {
      parts: parts,
      feet: footPair(1, phase, 3.4, 7.8, 2.1, amount)
        .concat(footPair(3, phase + Math.PI, 3.4, 7.8, 2.1, amount)),
    };
  }

  var samplers = { feet: littleFeet, inch: inchworm, guide: rowGuide };
  window.WyrmGaits = {
    metadata: metadata,
    sample: function (mode, timeSeconds, amount) {
      var time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
      var strength = Number.isFinite(amount) ? clamp(amount, 0, 1) : 0;
      return (samplers[mode] || samplers.feet)(time, strength);
    },
  };
}());
