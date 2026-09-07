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

        var SCALE_STEP = 0.75;
        var MIN_SCALE = 0.1;
        var scale = 1.0;

        function tryScale(resolve) {
            var w = Math.round(canvas.width * scale);
            var h = Math.round(canvas.height * scale);

            if (w < 4 || h < 4) {
                canvas.toBlob(function (b) { resolve(b); }, outputFormat, 0.01);
                return;
            }

            var resized = document.createElement("canvas");
            resized.width = w;
            resized.height = h;
            resized.getContext("2d").drawImage(canvas, 0, 0, w, h);

            binarySearchQuality(resized, targetBytes, outputFormat).then(function (result) {
                if (result.blob) {
                    resolve(result.blob);
                } else if (scale > MIN_SCALE) {
                    scale *= SCALE_STEP;
                    tryScale(resolve);
                } else {
                    resized.toBlob(function (b) { resolve(b); }, outputFormat, 0.01);
                }
            });
        }

        return new Promise(function (resolve) {
            tryScale(resolve);
        });
    }

    function binarySearchQuality(canvas, targetBytes, outputFormat) {
        return new Promise(function (resolve) {
            var low = 0.01;
            var high = 1.0;
            var bestBlob = null;
            var iterations = 0;
            var MAX_ITERATIONS = 15;

            function tryQuality(q) {
                iterations++;

                if (iterations > MAX_ITERATIONS || high - low < 0.005) {
                    resolve({ blob: bestBlob });
                    return;
                }

                canvas.toBlob(function (blob) {
                    if (blob.size <= targetBytes) {
                        bestBlob = blob;
                        low = q;
                    } else {
                        high = q;
                    }

                    if (high - low >= 0.005 && iterations < MAX_ITERATIONS) {
                        tryQuality((low + high) / 2);
                    } else {
                        resolve({ blob: bestBlob });
                    }
                }, outputFormat, q);
            }

            tryQuality(0.5);
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
        placeholder.style.display = "";
        document.querySelector(".final-size").textContent = "-";
        document.querySelector(".reduction-percent").textContent = "-";
        document.querySelector(".download-button").disabled = true;

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

        document.querySelector(".original-size").textContent = formatSize(file.size);

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
            var reduction = ((1 - compressedSize / originalBytes) * 100).toFixed(1);

            document.querySelector(".final-size").textContent = formatSize(compressedSize);
            document.querySelector(".reduction-percent").textContent = reduction + "%";

            if (compressedSize > targetBytes && outputFormat !== "image/png") {
                console.warn("ASSERTION FAILED: " + formatSize(compressedSize) + " > " + formatSize(targetBytes));
            }

            compressedBlobUrl = URL.createObjectURL(blob);
            compressedBlob = blob;

            compressedPreview.src = compressedBlobUrl;
            compressedPreview.style.display = "";
            placeholder.style.display = "none";

            document.querySelector(".download-button").disabled = false;
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
