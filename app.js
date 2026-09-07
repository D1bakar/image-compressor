(function () {
    "use strict";

    var dropzone = document.querySelector(".upload-dropzone");
    var fileInput = document.querySelector("#file-input");
    var compressButton = document.querySelector(".compress-button");
    var originalSize = document.querySelector(".original-size");
    var originalPreview = document.querySelector(".original-preview");
    var resultArea = document.querySelector(".result-area");
    var targetSizeSelect = document.querySelector("#target-size");
    var customSizeInput = document.querySelector("#custom-size");
    var customUnitSelect = document.querySelector("#custom-unit");
    var outputFormatSelect = document.querySelector("#output-format");

    var ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    var MAX_SIZE = 50 * 1024 * 1024; // 50 MB

    var selectedFile = null;
    var compressedBlobUrl = null;

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    }

    function isValidImage(file) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return false;
        }
        return true;
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

        return new Promise(function (resolve) {
            var low = 0.01;
            var high = 1.0;
            var best = null;

            function tryQuality(q) {
                canvas.toBlob(function (blob) {
                    if (blob.size <= targetBytes) {
                        best = blob;
                        low = q;
                    } else {
                        high = q;
                    }

                    if (high - low > 0.01) {
                        tryQuality((low + high) / 2);
                    } else {
                        if (!best) {
                            canvas.toBlob(function (b) {
                                resolve(b);
                            }, outputFormat, low);
                        } else {
                            resolve(best);
                        }
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

        if (compressedBlobUrl) {
            URL.revokeObjectURL(compressedBlobUrl);
            compressedBlobUrl = null;
        }

        selectedFile = file;
        originalSize.textContent = formatSize(file.size);

        var reader = new FileReader();
        reader.onload = function (e) {
            originalPreview.src = e.target.result;
            resultArea.classList.add("visible");
            compressButton.disabled = false;
        };
        reader.readAsDataURL(file);
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

            compressedBlobUrl = URL.createObjectURL(blob);
            document.querySelector(".compressed-preview").src = compressedBlobUrl;
            resultArea.classList.add("visible");
        });
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
