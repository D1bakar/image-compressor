(function () {
    "use strict";

    var dropzone = document.querySelector(".upload-dropzone");
    var fileInput = document.querySelector("#file-input");
    var compressButton = document.querySelector(".compress-button");
    var originalSize = document.querySelector(".original-size");
    var originalPreview = document.querySelector(".original-preview");
    var resultArea = document.querySelector(".result-area");

    var ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    var MAX_SIZE = 50 * 1024 * 1024; // 50 MB

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

    // Drag events
    dropzone.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropzone.classList.add("dragover");
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
