/* ==========================================================================
   JavaScript 應用邏輯 - CaptionSafe 字幕轉換器
   支援拖曳、批次本地讀取、SRT 轉 WebVTT 格式化、以及批次下載
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileListBox = document.getElementById('file-list-box');
    const fileCountSpan = document.getElementById('file-count');
    const fileItemsList = document.getElementById('file-items-list');
    const btnConvertAll = document.getElementById('btn-convert-all');
    
    const previewSection = document.getElementById('preview-section');
    const previewFilename = document.getElementById('preview-filename');
    const previewContent = document.getElementById('preview-content');
    const btnDownloadPreview = document.getElementById('btn-download-preview');

    // 儲存待處理的檔案清單
    let selectedFiles = [];
    let convertedResults = {}; // 鍵: 檔案名稱, 值: VTT 文字內容

    // ==========================================================================
    // 拖放 (Drag & Drop) 與點擊事件處理
    // ==========================================================================

    // 觸發選擇檔案
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; // 清空以允許重複選擇同檔案
    });

    // 拖曳狀態變化
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('active');
        }, false);
    });

    // 放置檔案
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    });

    // ==========================================================================
    // 檔案清單處理與 UI 渲染
    // ==========================================================================

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            // 驗證是否為 .srt 檔案
            if (file.name.toLowerCase().endsWith('.srt')) {
                // 防止重複加入同名檔案
                if (!selectedFiles.some(f => f.name === file.name)) {
                    selectedFiles.push(file);
                }
            } else {
                alert(`【格式錯誤】「${file.name}」不是 SRT 字幕檔。`);
            }
        });
        updateFileListView();
    }

    function updateFileListView() {
        if (selectedFiles.length === 0) {
            fileListBox.style.display = 'none';
            previewSection.style.display = 'none';
            return;
        }

        fileListBox.style.display = 'block';
        fileCountSpan.textContent = selectedFiles.length;
        fileItemsList.innerHTML = '';

        selectedFiles.forEach((file, index) => {
            const sizeKB = (file.size / 1024).toFixed(1);
            const isConverted = convertedResults[file.name] !== undefined;
            const statusText = isConverted ? '轉換成功' : '等待中';
            const statusClass = isConverted ? 'status-success' : 'status-waiting';
            
            const itemHtml = `
                <div class="file-item" data-index="${index}">
                    <div class="file-info">
                        <i class="fa-solid fa-file-lines file-icon"></i>
                        <div>
                            <span class="file-name" title="${file.name}">${file.name}</span>
                            <span class="file-size">(${sizeKB} KB)</span>
                        </div>
                    </div>
                    <div>
                        <span class="file-status ${statusClass}">${statusText}</span>
                        <button class="btn-remove" data-index="${index}">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            `;
            fileItemsList.insertAdjacentHTML('beforeend', itemHtml);
        });

        // 綁定單個移除按鈕事件
        fileItemsList.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'));
                const filename = selectedFiles[idx].name;
                selectedFiles.splice(idx, 1);
                delete convertedResults[filename];
                updateFileListView();
            });
        });

        // 綁定點擊檔案項目進行單獨預覽
        fileItemsList.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.getAttribute('data-index'));
                const file = selectedFiles[idx];
                processSingleFileForPreview(file);
            });
        });

        // 預設對第一個檔案做預覽
        if (selectedFiles.length > 0 && !previewSection.offsetParent) {
            processSingleFileForPreview(selectedFiles[0]);
        }
    }

    // ==========================================================================
    // SRT 轉 VTT 核心算法
    // ==========================================================================

    function srtToVtt(srtText) {
        // 1. 統一換行符為 \n
        let vtt = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 2. 去除前後空白
        vtt = vtt.trim();

        // 3. 確保開頭加上 WEBVTT
        if (!vtt.startsWith('WEBVTT')) {
            vtt = 'WEBVTT\n\n' + vtt;
        }

        // 4. 正則表達式：替換時間格式中的逗號「,」為點號「.」
        // 時間格式為: 00:00:00,000 --> 00:00:00,000
        const timeRegex = /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g;
        vtt = vtt.replace(timeRegex, '$1.$2 --> $3.$4');

        return vtt;
    }

    // ==========================================================================
    // 單一檔案與批次處理邏輯
    // ==========================================================================

    // 處理預覽
    function processSingleFileForPreview(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const srtText = e.target.result;
            const vttText = srtToVtt(srtText);
            
            // 存入快取
            convertedResults[file.name] = vttText;
            
            // 更新 UI 預覽
            previewFilename.textContent = file.name.replace(/\.srt$/i, '.vtt');
            previewContent.textContent = vttText;
            previewSection.style.display = 'block';
            
            // 同步更新列表中該檔案的狀態
            updateFileListView();
        };
        reader.readAsText(file);
    }

    // 下載單一檔案的輔助函數
    function triggerDownload(content, filename) {
        const blob = new Blob([content], { type: 'text/vtt;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 批次轉換並下載
    btnConvertAll.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        console.log(`開始處理批次下載，共 ${selectedFiles.length} 個檔案...`);

        // 循序下載：為了避免瀏覽器封鎖多重下載，使用間隔（delay）排程
        selectedFiles.forEach((file, index) => {
            setTimeout(() => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const srtText = e.target.result;
                    const vttText = srtToVtt(srtText);
                    const newFilename = file.name.replace(/\.srt$/i, '.vtt');
                    
                    // 下載
                    triggerDownload(vttText, newFilename);
                    
                    // 更新快取與 UI
                    convertedResults[file.name] = vttText;
                    if (index === selectedFiles.length - 1) {
                        updateFileListView();
                        alert('🎉 所有檔案皆已轉換並下載完成！');
                    }
                };
                reader.readAsText(file);
            }, index * 400); // 每個檔案間隔 400 毫秒下載
        });
    });

    // 單獨下載預覽區檔案
    btnDownloadPreview.addEventListener('click', () => {
        const vttName = previewFilename.textContent;
        const srtName = vttName.replace(/\.vtt$/i, '.srt');
        const content = convertedResults[srtName];
        
        if (content) {
            triggerDownload(content, vttName);
        } else {
            alert('尚未生成轉換內容！');
        }
    });
});
