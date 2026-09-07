(function () {
    "use strict";

    var dropzone = document.querySelector(".upload-dropzone");
    var fileInput = document.querySelector("#file-input");
    var compressButton = document.querySelector(".compress-button");
    var resultArea = document.querySelector(".result-area");
    var targetSizeSelect = document.querySelector("#target-size");
    var customSizeInput = document.querySelector("#custom-size");
    var customUnitSelect = document.querySelector("#custom-unit");
    var outputFormatSelect = document.querySelector("#output-format");

    var ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    var MAX_SIZE = 50 * 1024 * 1024;

    var selectedFile = null;
    var compressedBlobUrl = null;
    var compressedBlob = null;
    var originalBlobUrl = null;

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    }

    function isValidImage(file) {
        return ACCEPTED_TYPES.includes(file.type);
    }

    function handleError(message) {
        alert(message);
    }

    function getTargetSizeBytes() {
        var value = targetSizeSelect.value;
        if (value === "custom") {
            var num = parseInt(customSizeInput.value, 10);
            var unit = parseInt(customUnitSelect.value, 10);
            if (isNaN(num) || num < 1) return 0;
            return num * unit;
        }
        return parseInt(value, 10);
    }

    function toggleCustomSize() {
        var isCustom = targetSizeSelect.value === "custom";
        customSizeInput.style.display = isCustom ? "" : "none";
        customUnitSelect.style.display = isCustom ? "" : "none";
    }

    function canvasToTargetSize(canvas, targetBytes, outputFormat) {
        if (outputFormat === "image/png") {
            return new Promise(function (resolve) {
                canvas.toBlob(function (blob) {
                    resolve(blob);
                }, "image/png");
            });
        }

        var MAX_QUALITY_ITERS = 20;
        var MIN_QUALITY_STEP = 0.002;
        var SCALE_STEP = 0.8;
        var MIN_SCALE = 0.05;
        var scale = 1.0;

        function encode(canvas, format, quality) {
            return new Promise(function (resolve) {
                canvas.toBlob(function (blob) {
                    resolve(blob);
                }, format, quality);
            });
        }

        function binarySearch(cvs, format) {
            var low = 0.01;
            var high = 1.0;
            var bestBlob = null;
            var iter = 0;

            return new Promise(function (resolve) {
                function step(q) {
                    iter++;
                    encode(cvs, format, q).then(function (blob) {
                        if (blob.size <= targetBytes) {
                            bestBlob = blob;
                            low = q;
                        } else {
                            high = q;
                        }

                        var range = high - low;
                        if (range < MIN_QUALITY_STEP || iter >= MAX_QUALITY_ITERS) {
                            resolve(bestBlob);
                        } else {
                            step((low + high) / 2);
                        }
                    });
                }
                step(0.5);
            });
        }

        function tryScale(resolve) {
            var w = Math.round(canvas.width * scale);
            var h = Math.round(canvas.height * scale);

            if (w < 4 || h < 4) {
                encode(canvas, outputFormat, 0.01).then(resolve);
                return;
            }

            var resized = document.createElement("canvas");
            resized.width = w;
            resized.height = h;
            resized.getContext("2d").drawImage(canvas, 0, 0, w, h);

            binarySearch(resized, outputFormat).then(function (blob) {
                if (blob) {
                    resolve(blob);
                } else if (scale > MIN_SCALE) {
                    scale *= SCALE_STEP;
                    tryScale(resolve);
                } else {
                    encode(resized, outputFormat, 0.01).then(resolve);
                }
            });
        }

        return new Promise(function (resolve) {
            encode(canvas, outputFormat, 1.0).then(function (fullBlob) {
                if (fullBlob.size <= targetBytes) {
                    resolve(fullBlob);
                    return;
                }
                tryScale(resolve);
            });
        });
    }

    function drawToCanvas(imageSource) {
        var canvas = document.createElement("canvas");
        canvas.width = imageSource.width || imageSource.naturalWidth;
        canvas.height = imageSource.height || imageSource.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(imageSource, 0, 0);
        return canvas;
    }

    function compressImage(file, targetBytes, outputFormat) {
        if (typeof createImageBitmap === "function") {
            return createImageBitmap(file).then(function (imageBitmap) {
                var canvas = drawToCanvas(imageBitmap);
                imageBitmap.close();
                return canvasToTargetSize(canvas, targetBytes, outputFormat);
            });
        }

        return new Promise(function (resolve) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                var canvas = drawToCanvas(img);
                URL.revokeObjectURL(url);
                canvasToTargetSize(canvas, targetBytes, outputFormat).then(resolve);
            };
            img.src = url;
        });
    }

    function resetResult() {
        var compressedPreview = document.querySelector(".compressed-preview");
        var placeholder = document.querySelector(".preview-placeholder");
        compressedPreview.src = "";
        compressedPreview.style.display = "none";
        compressedPreview.classList.remove("loaded");
        placeholder.style.display = "";
        document.querySelector(".final-size").textContent = "-";
        document.querySelector(".final-size").classList.remove("has-value");
        var reductionEl = document.querySelector(".reduction-percent");
        reductionEl.textContent = "-";
        reductionEl.style.color = "";
        document.querySelector(".download-button").disabled = true;
        document.querySelector(".download-button").classList.remove("visible");

        if (compressedBlobUrl) {
            URL.revokeObjectURL(compressedBlobUrl);
            compressedBlobUrl = null;
            compressedBlob = null;
        }
    }

    function handleFile(file) {
        if (!file) return;

        if (!isValidImage(file)) {
            handleError("Invalid file type. Please select a JPEG, PNG, GIF, WebP, or SVG image.");
            return;
        }

        if (file.size > MAX_SIZE) {
            handleError("File is too large. Maximum size is 50 MB.");
            return;
        }

        selectedFile = file;

        if (originalBlobUrl) {
            URL.revokeObjectURL(originalBlobUrl);
        }
        originalBlobUrl = URL.createObjectURL(file);

        var originalPreview = document.querySelector(".original-preview");
        originalPreview.src = originalBlobUrl;
        originalPreview.style.display = "";
        originalPreview.classList.add("loaded");

        document.querySelector(".original-size").textContent = formatSize(file.size);
        document.querySelector(".original-size").classList.add("has-value");

        resetResult();

        resultArea.classList.add("visible");
        compressButton.disabled = false;
    }

    // Dropzone click
    dropzone.addEventListener("click", function () {
        fileInput.click();
    });

    // Dropzone keyboard
    dropzone.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.click();
        }
    });

    // File input change
    fileInput.addEventListener("change", function () {
        handleFile(fileInput.files[0]);
    });

    // Target size change
    targetSizeSelect.addEventListener("change", toggleCustomSize);

    // Compress button
    compressButton.addEventListener("click", function () {
        if (!selectedFile) return;

        var targetBytes = getTargetSizeBytes();
        if (targetBytes <= 0) {
            handleError("Please select a valid target size.");
            return;
        }

        compressButton.disabled = true;
        compressButton.classList.add("loading");

        var compressedPreview = document.querySelector(".compressed-preview");
        var placeholder = document.querySelector(".preview-placeholder");

        var outputFormat = outputFormatSelect.value;
        compressImage(selectedFile, targetBytes, outputFormat).then(function (blob) {
            compressButton.classList.remove("loading");
            compressButton.disabled = false;

            if (compressedBlobUrl) {
                URL.revokeObjectURL(compressedBlobUrl);
            }

            var compressedSize = blob.size;
            var originalBytes = selectedFile.size;
            var diff = compressedSize - originalBytes;
            var reductionPercent = ((1 - compressedSize / originalBytes) * 100).toFixed(1);

            document.querySelector(".final-size").textContent = formatSize(compressedSize);

            var reductionEl = document.querySelector(".reduction-percent");
            if (diff > 0) {
                reductionEl.textContent = "+" + formatSize(diff) + " larger";
                reductionEl.style.color = "#e17055";
            } else if (diff < 0) {
                reductionEl.textContent = formatSize(Math.abs(diff)) + " saved";
                reductionEl.style.color = "#00b894";
            } else {
                reductionEl.textContent = "Same size";
                reductionEl.style.color = "#495057";
            }

            if (compressedSize > targetBytes && outputFormat !== "image/png") {
                console.warn("ASSERTION FAILED: " + formatSize(compressedSize) + " > " + formatSize(targetBytes));
            }

            compressedBlobUrl = URL.createObjectURL(blob);
            compressedBlob = blob;

            compressedPreview.src = compressedBlobUrl;
            compressedPreview.style.display = "";
            compressedPreview.classList.add("loaded");
            placeholder.style.display = "none";

            document.querySelector(".final-size").classList.add("has-value");

            var dlBtn = document.querySelector(".download-button");
            dlBtn.disabled = false;
            dlBtn.classList.add("visible");
        });
    });

    // Download button
    document.querySelector(".download-button").addEventListener("click", function () {
        if (!compressedBlob) return;

        var ext = "jpg";
        var fmt = outputFormatSelect.value;
        if (fmt === "image/png") ext = "png";
        else if (fmt === "image/webp") ext = "webp";

        var a = document.createElement("a");
        a.href = compressedBlobUrl;
        a.download = "compressed." + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Drag events
    dropzone.addEventListener("dragenter", function (e) {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragover", function (e) {
        e.preventDefault();
    });

    dropzone.addEventListener("dragleave", function () {
        dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        var file = e.dataTransfer.files[0];
        handleFile(file);
    });
})();
