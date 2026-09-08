(function () {
    "use strict";

    var ImageProcessing = {};

    function cloneCanvas(canvas) {
        var clone = document.createElement("canvas");
        clone.width = canvas.width;
        clone.height = canvas.height;
        clone.getContext("2d").drawImage(canvas, 0, 0);
        return clone;
    }

    function clamp(val, min, max) {
        return val < min ? min : val > max ? max : val;
    }

    // --- Gaussian Blur (box blur approximation) ---
    // Runs multiple box blur passes to approximate Gaussian
    ImageProcessing.gaussianBlur = function (canvas, radius) {
        if (radius < 1) return canvas;
        var ctx = canvas.getContext("2d");
        var w = canvas.width;
        var h = canvas.height;
        var imageData = ctx.getImageData(0, 0, w, h);
        var data = imageData.data;
        var passes = Math.max(1, Math.round(radius / 3));
        var r = Math.round(radius / passes);

        for (var p = 0; p < passes; p++) {
            boxBlur(data, w, h, r);
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    };

    function boxBlur(data, w, h, r) {
        var temp = new Uint8ClampedArray(data.length);
        var i, x, y, idx;
        var boxSize = 2 * r + 1;
        var invBox = 1 / boxSize;

        // Horizontal pass
        for (y = 0; y < h; y++) {
            var rSum = 0, gSum = 0, bSum = 0, aSum = 0;
            for (x = -r; x <= r; x++) {
                idx = (y * w + clamp(x, 0, w - 1)) * 4;
                rSum += data[idx];
                gSum += data[idx + 1];
                bSum += data[idx + 2];
                aSum += data[idx + 3];
            }
            for (x = 0; x < w; x++) {
                idx = (y * w + x) * 4;
                temp[idx] = rSum * invBox;
                temp[idx + 1] = gSum * invBox;
                temp[idx + 2] = bSum * invBox;
                temp[idx + 3] = aSum * invBox;

                var removeX = clamp(x - r, 0, w - 1);
                var addX = clamp(x + r + 1, 0, w - 1);
                var removeIdx = (y * w + removeX) * 4;
                var addIdx = (y * w + addX) * 4;
                rSum += data[addIdx] - data[removeIdx];
                gSum += data[addIdx + 1] - data[removeIdx + 1];
                bSum += data[addIdx + 2] - data[removeIdx + 2];
                aSum += data[addIdx + 3] - data[removeIdx + 3];
            }
        }

        // Vertical pass
        for (x = 0; x < w; x++) {
            var rSum2 = 0, gSum2 = 0, bSum2 = 0, aSum2 = 0;
            for (y = -r; y <= r; y++) {
                idx = (clamp(y, 0, h - 1) * w + x) * 4;
                rSum2 += temp[idx];
                gSum2 += temp[idx + 1];
                bSum2 += temp[idx + 2];
                aSum2 += temp[idx + 3];
            }
            for (y = 0; y < h; y++) {
                idx = (y * w + x) * 4;
                data[idx] = rSum2 * invBox;
                data[idx + 1] = gSum2 * invBox;
                data[idx + 2] = bSum2 * invBox;
                data[idx + 3] = aSum2 * invBox;

                var removeY = clamp(y - r, 0, h - 1);
                var addY = clamp(y + r + 1, 0, h - 1);
                var removeIdx2 = (removeY * w + x) * 4;
                var addIdx2 = (addY * w + x) * 4;
                rSum2 += temp[addIdx2] - temp[removeIdx2];
                gSum2 += temp[addIdx2 + 1] - temp[removeIdx2 + 1];
                bSum2 += temp[addIdx2 + 2] - temp[removeIdx2 + 2];
                aSum2 += temp[addIdx2 + 3] - temp[removeIdx2 + 3];
            }
        }
    }

    // --- Noise Reduction ---
    // Blurs the image and blends with original to preserve edges
    // strength: 0 (no effect) to 1 (full blur)
    ImageProcessing.noiseReduction = function (canvas, strength) {
        if (strength <= 0) return canvas;
        var radius = Math.round(strength * 4) + 1;
        var blurred = cloneCanvas(canvas);
        ImageProcessing.gaussianBlur(blurred, radius);

        var ctx = canvas.getContext("2d");
        var origData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var blurData = blurred.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        var orig = origData.data;
        var blur = blurData.data;
        var len = orig.length;

        // Blend: more strength = more blurred pixels
        for (var i = 0; i < len; i += 4) {
            orig[i] = clamp(Math.round(orig[i] * (1 - strength) + blur[i] * strength), 0, 255);
            orig[i + 1] = clamp(Math.round(orig[i + 1] * (1 - strength) + blur[i + 1] * strength), 0, 255);
            orig[i + 2] = clamp(Math.round(orig[i + 2] * (1 - strength) + blur[i + 2] * strength), 0, 255);
        }

        ctx.putImageData(origData, 0, 0);
        return canvas;
    };

    // --- Unsharp Mask (Sharpening) ---
    // amount: 0 (no sharpen) to 1 (strong sharpen)
    // radius: blur radius for detail extraction
    ImageProcessing.sharpen = function (canvas, amount, radius) {
        if (amount <= 0) return canvas;
        radius = radius || 1;
        var blurred = cloneCanvas(canvas);
        ImageProcessing.gaussianBlur(blurred, radius);

        var ctx = canvas.getContext("2d");
        var origData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var blurData = blurred.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        var orig = origData.data;
        var blur = blurData.data;
        var len = orig.length;

        // detail = original - blurred, add scaled detail back
        for (var i = 0; i < len; i += 4) {
            orig[i] = clamp(Math.round(orig[i] + (orig[i] - blur[i]) * amount), 0, 255);
            orig[i + 1] = clamp(Math.round(orig[i + 1] + (orig[i + 1] - blur[i + 1]) * amount), 0, 255);
            orig[i + 2] = clamp(Math.round(orig[i + 2] + (orig[i + 2] - blur[i + 2]) * amount), 0, 255);
        }

        ctx.putImageData(origData, 0, 0);
        return canvas;
    };

    // --- Auto Contrast ---
    // Stretches histogram per channel (clips top/bottom 1%)
    ImageProcessing.autoContrast = function (canvas) {
        var ctx = canvas.getContext("2d");
        var w = canvas.width;
        var h = canvas.height;
        var imageData = ctx.getImageData(0, 0, w, h);
        var data = imageData.data;
        var totalPixels = w * h;
        var clipPercent = 0.01;
        var clipCount = Math.floor(totalPixels * clipPercent);

        var channels = [0, 1, 2]; // R, G, B

        for (var c = 0; c < 3; c++) {
            var histogram = new Uint32Array(256);
            for (var i = c; i < data.length; i += 4) {
                histogram[data[i]]++;
            }

            var cumulative = 0;
            var low = 0, high = 255;

            for (var v = 0; v < 256; v++) {
                cumulative += histogram[v];
                if (cumulative >= clipCount) {
                    low = v;
                    break;
                }
            }

            cumulative = 0;
            for (var v2 = 255; v2 >= 0; v2--) {
                cumulative += histogram[v2];
                if (cumulative >= clipCount) {
                    high = v2;
                    break;
                }
            }

            if (high <= low) continue;

            var range = high - low;
            var scale = 255 / range;
            var offset = -low * scale;

            for (var i2 = c; i2 < data.length; i2 += 4) {
                data[i2] = clamp(Math.round(data[i2] * scale + offset), 0, 255);
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    };

    // --- Auto Color Correction ---
    // Gray-world white balance + mild saturation boost
    ImageProcessing.autoColor = function (canvas) {
        var ctx = canvas.getContext("2d");
        var w = canvas.width;
        var h = canvas.height;
        var imageData = ctx.getImageData(0, 0, w, h);
        var data = imageData.data;
        var totalPixels = w * h;

        // Calculate average of each channel (gray world)
        var rSum = 0, gSum = 0, bSum = 0;
        for (var i = 0; i < data.length; i += 4) {
            rSum += data[i];
            gSum += data[i + 1];
            bSum += data[i + 2];
        }
        var rAvg = rSum / totalPixels;
        var gAvg = gSum / totalPixels;
        var bAvg = bSum / totalPixels;
        var avg = (rAvg + gAvg + bAvg) / 3;

        // Gray-world gains
        var rGain = avg / (rAvg || 1);
        var gGain = avg / (gAvg || 1);
        var bGain = avg / (bAvg || 1);

        // Mild gains to avoid overcorrection (blend 60% correction)
        var blend = 0.6;
        rGain = 1 + (rGain - 1) * blend;
        gGain = 1 + (gGain - 1) * blend;
        bGain = 1 + (bGain - 1) * blend;

        // Saturation boost factor
        var satBoost = 1.1;

        for (var i2 = 0; i2 < data.length; i2 += 4) {
            var r = data[i2] * rGain;
            var g = data[i2 + 1] * gGain;
            var b = data[i2 + 2] * bGain;

            // Saturation boost via luminance blending
            var lum = 0.299 * r + 0.587 * g + 0.114 * b;
            r = lum + (r - lum) * satBoost;
            g = lum + (g - lum) * satBoost;
            b = lum + (b - lum) * satBoost;

            data[i2] = clamp(Math.round(r), 0, 255);
            data[i2 + 1] = clamp(Math.round(g), 0, 255);
            data[i2 + 2] = clamp(Math.round(b), 0, 255);
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    };

    // --- Upscale ---
    // factor: 1.5, 2.0, etc. Uses bilinear interpolation via canvas drawImage scaling
    ImageProcessing.upscale = function (canvas, factor) {
        if (factor <= 1) return canvas;
        var newW = Math.round(canvas.width * factor);
        var newH = Math.round(canvas.height * factor);
        var upCanvas = document.createElement("canvas");
        upCanvas.width = newW;
        upCanvas.height = newH;
        var ctx = upCanvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(canvas, 0, 0, newW, newH);
        return upCanvas;
    };

    // --- Enhancement Pipeline ---
    // options: { sharpenAmount, noiseReductionStrength, upscaleFactor, autoContrast, autoColor }
    ImageProcessing.enhanceImage = function (canvas, options) {
        var opts = options || {};
        var result = cloneCanvas(canvas);

        // Apply enhancements in order: noise → color → contrast
        // (sharpening is applied AFTER compression by the caller)
        if (opts.noiseReductionStrength && opts.noiseReductionStrength > 0) {
            ImageProcessing.noiseReduction(result, opts.noiseReductionStrength);
        }

        if (opts.autoColor !== false) {
            ImageProcessing.autoColor(result);
        }

        if (opts.autoContrast !== false) {
            ImageProcessing.autoContrast(result);
        }

        if (opts.upscaleFactor && opts.upscaleFactor > 1) {
            result = ImageProcessing.upscale(result, opts.upscaleFactor);
        }

        return result;
    };

    // --- Apply Sharpening to a Blob (for post-compression sharpening) ---
    // Returns a promise that resolves with a new Blob
    ImageProcessing.sharpenBlob = function (blob, format, amount) {
        return new Promise(function (resolve) {
            if (amount <= 0) {
                resolve(blob);
                return;
            }

            var url = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext("2d").drawImage(img, 0, 0);

                ImageProcessing.sharpen(canvas, amount, 1);

                canvas.toBlob(function (newBlob) {
                    URL.revokeObjectURL(url);
                    resolve(newBlob || blob);
                }, format);
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                resolve(blob);
            };
            img.src = url;
        });
    };

    window.ImageProcessing = ImageProcessing;
})();
