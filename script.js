// Chart.jsのグラフインスタンス
let memoryChart;
let diskChart;
let servicesChart;

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 指定された日付範囲のヘルスチェックデータを読み込む
        const healthData = await loadHealthCheckData();
        
        if (healthData.length === 0) {
            throw new Error('指定された期間内のデータが見つかりませんでした');
        }
        
        // データを日付順にソート
        healthData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 各グラフを作成
        createMemoryChart(healthData);
        createDiskChart(healthData);
        createServicesChart(healthData);
        
        // 読み込んだファイル数を表示
        const dataInfo = document.createElement('div');
        dataInfo.textContent = `${healthData.length}件のデータを読み込みました（${formatDate(healthData[0].date)} 〜 ${formatDate(healthData[healthData.length - 1].date)}）`;
        document.querySelector('.data-info').appendChild(dataInfo);
        
        // ローディングメッセージを非表示
        hideLoading();
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        showError('データの読み込みに失敗しました: ' + error.message);
    }
});

/**
 * 選択されたグラフのみを表示
 */
function showSelectedChart(chartType) {
    const memoryContainer = document.getElementById('memoryChartContainer');
    const diskContainer = document.getElementById('diskChartContainer');
    const servicesContainer = document.getElementById('servicesChartContainer');
    
    // すべて非表示にしてから選択されたものだけ表示
    memoryContainer.style.display = 'none';
    diskContainer.style.display = 'none';
    servicesContainer.style.display = 'none';
    
    switch (chartType) {
        case 'memory':
            memoryContainer.style.display = 'block';
            break;
        case 'disk':
            diskContainer.style.display = 'block';
            break;
        case 'services':
            servicesContainer.style.display = 'block';
            break;
        case 'all':
            memoryContainer.style.display = 'block';
            diskContainer.style.display = 'block';
            servicesContainer.style.display = 'block';
            break;
    }
}

/**
 * 指定された日付範囲（2025-01-31から2025-03-07）のヘルスチェックデータを読み込む
 * @returns {Promise<Array>} 日付と各種データを含むオブジェクトの配列
 */
async function loadHealthCheckData() {
    showLoading('データを読み込んでいます...');
    
    const healthData = [];
    const loadedFiles = new Set(); // 既に読み込んだファイル名を記録
    
    // 指定された日付範囲
    const startDate = new Date('2025-01-31');
    const endDate = new Date('2025-03-07');
    
    console.log(`指定された日付範囲のデータを読み込みます: ${formatDate(startDate.toISOString().split('T')[0])} から ${formatDate(endDate.toISOString().split('T')[0])}`);
    
    // 日付の範囲内のすべての日を試す
    for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
        // YYYY-MM-DD形式に変換
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        
        const fileName = `health-check-${year}-${month}-${day}.json`;
        
        // 既に試したファイルはスキップ
        if (loadedFiles.has(fileName)) continue;
        loadedFiles.add(fileName);
        
        try {
            // ファイルを読み込む
            const response = await fetch(`src/${fileName}`);
            
            // レスポンスが成功しなかった場合はスキップ
            if (!response.ok) {
                console.log(`ファイルが見つかりません: ${fileName}`);
                continue; // このファイルは存在しないのでスキップ
            }
            
            // JSONデータをパース
            const data = await response.json();
            
            // ファイル名から日付を抽出
            const date = extractDateFromFilename(fileName);
            
            if (date) {
                // メモリ、ディスク、サービスデータの取得
                const healthInfo = {
                    date: date,
                    usedMemory: data.memory?.used_mb,
                    diskUsagePercentage: data.disk?.usage_percentage,
                    services: {
                        mitra: data.services?.mitra === 'active' ? 1 : 0,
                        postgresql: data.services?.postgresql === 'active' ? 1 : 0,
                        nginx: data.services?.nginx === 'active' ? 1 : 0
                    }
                };
                
                healthData.push(healthInfo);
                console.log(`データを読み込みました: ${fileName}`);
            }
        } catch (error) {
            console.warn(`ファイル ${fileName} の処理中にエラーが発生しました:`, error);
            // このファイルは存在しないか読み込めないのでスキップ
        }
    }
    
    return healthData;
}

/**
 * ファイル名から日付を抽出する
 * @param {string} filename ファイル名
 * @returns {string|null} YYYY-MM-DD形式の日付文字列、または取得できない場合はnull
 */
function extractDateFromFilename(filename) {
    const match = filename.match(/health-check-(\d{4}-\d{2}-\d{2})\.json/);
    if (match && match[1]) {
        return match[1]; // YYYY-MM-DD形式
    }
    return null;
}

/**
 * 日付文字列を整形する（YYYY-MM-DD → YYYY年MM月DD日）
 */
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${year}年${month}月${day}日`;
}

/**
 * メモリ使用量のグラフを作成する
 * @param {Array} healthData ヘルスチェックデータの配列
 */
function createMemoryChart(healthData) {
    // 既存のグラフを破棄
    if (memoryChart) {
        memoryChart.destroy();
    }
    
    // データとラベルを準備
    const labels = healthData.map(item => item.date);
    const memoryData = healthData.map(item => item.usedMemory);
    
    // メモリ使用量の最小値と最大値を計算
    const validMemoryData = memoryData.filter(value => value !== undefined && value !== null);
    const minValue = Math.min(...validMemoryData);
    const maxValue = Math.max(...validMemoryData);
    
    // Y軸の範囲を計算
    // 最小値を切り下げて、最大値を切り上げて余裕を持たせる
    const yMin = Math.max(0, Math.floor(minValue / 50) * 50);
    const yMax = Math.ceil(maxValue / 50) * 50 + 50; // 上に50MBの余裕を持たせる
    
    // stepSizeを計算 (値の範囲に応じて自動調整)
    const range = yMax - yMin;
    let stepSize;
    if (range <= 100) {
        stepSize = 10; // 範囲が狭い場合は10MB間隔
    } else if (range <= 300) {
        stepSize = 25; // 中程度の範囲は25MB間隔
    } else {
        stepSize = 50; // 範囲が広い場合は50MB間隔
    }
    
    console.log(`メモリグラフのY軸範囲: ${yMin}MB〜${yMax}MB (間隔: ${stepSize}MB)`);
    
    // グラフのコンテキストを取得
    const ctx = document.getElementById('memoryChart').getContext('2d');
    
    // グラフを作成
    memoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'メモリ使用量 (MB)',
                data: memoryData,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointRadius: healthData.length > 50 ? 3 : 5,
                pointHoverRadius: 7,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '日付'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 20
                    }
                },
                y: {
                    min: yMin,
                    max: yMax,
                    title: {
                        display: true,
                        text: 'メモリ使用量 (MB)'
                    },
                    ticks: {
                        stepSize: stepSize,
                        callback: function(value, index, values) {
                            return value.toLocaleString() + ' MB';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return '日付: ' + formatDate(tooltipItems[0].label);
                        },
                        label: function(context) {
                            return 'メモリ使用量: ' + context.raw.toLocaleString() + ' MB';
                        }
                    }
                }
            }
        }
    });
}

/**
 * ディスク使用率のグラフを作成する
 * @param {Array} healthData ヘルスチェックデータの配列
 */
function createDiskChart(healthData) {
    // 既存のグラフを破棄
    if (diskChart) {
        diskChart.destroy();
    }
    
    // データとラベルを準備
    const labels = healthData.map(item => item.date);
    const diskData = healthData.map(item => item.diskUsagePercentage);
    
    // ディスク使用率の最小値と最大値を計算
    const validDiskData = diskData.filter(value => value !== undefined && value !== null);
    const minValue = Math.min(...validDiskData);
    const maxValue = Math.max(...validDiskData);
    
    // Y軸の範囲を計算 (0%〜100%を基本とし、必要に応じて調整)
    const yMin = 0;
    const yMax = Math.max(100, Math.ceil(maxValue / 5) * 5); // 上に余裕を持たせる
    
    // グラフのコンテキストを取得
    const ctx = document.getElementById('diskChart').getContext('2d');
    
    // グラフを作成
    diskChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ディスク使用率 (%)',
                data: diskData,
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(255, 159, 64, 1)',
                pointBorderColor: '#fff',
                pointRadius: healthData.length > 50 ? 3 : 5,
                pointHoverRadius: 7,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '日付'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 20
                    }
                },
                y: {
                    min: 10,
                    max: 20,
                    title: {
                        display: true,
                        text: 'ディスク使用率 (%)'
                    },
                    ticks: {
                        stepSize: 5,
                        callback: function(value, index, values) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return '日付: ' + formatDate(tooltipItems[0].label);
                        },
                        label: function(context) {
                            return 'ディスク使用率: ' + context.raw + '%';
                        }
                    }
                }
            }
        }
    });
}

/**
 * サービスステータスのグラフを作成する
 * @param {Array} healthData ヘルスチェックデータの配列
 */
function createServicesChart(healthData) {
    // 既存のグラフを破棄
    if (servicesChart) {
        servicesChart.destroy();
    }
    
    // データとラベルを準備
    const labels = healthData.map(item => item.date);
    
    // サービスデータを抽出
    const mitraData = healthData.map(item => item.services?.mitra);
    const postgresqlData = healthData.map(item => item.services?.postgresql);
    const nginxData = healthData.map(item => item.services?.nginx);
    
    // グラフのコンテキストを取得
    const ctx = document.getElementById('servicesChart').getContext('2d');
    
    // グラフを作成
    servicesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Mitra',
                    data: mitraData,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    pointBorderColor: '#fff',
                    pointRadius: healthData.length > 50 ? 3 : 5,
                    pointHoverRadius: 7,
                    stepped: true
                },
                {
                    label: 'PostgreSQL',
                    data: postgresqlData,
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(153, 102, 255, 1)',
                    pointBorderColor: '#fff',
                    pointRadius: healthData.length > 50 ? 3 : 5,
                    pointHoverRadius: 7,
                    stepped: true
                },
                {
                    label: 'Nginx',
                    data: nginxData,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                    pointBorderColor: '#fff',
                    pointRadius: healthData.length > 50 ? 3 : 5,
                    pointHoverRadius: 7,
                    stepped: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '日付'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 20
                    }
                },
                y: {
                    min: 0,
                    max: 1,
                    title: {
                        display: true,
                        text: 'サービスステータス'
                    },
                    ticks: {
                        stepSize: 1,
                        callback: function(value, index, values) {
                            return value === 1 ? 'Active' : 'Inactive';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return '日付: ' + formatDate(tooltipItems[0].label);
                        },
                        label: function(context) {
                            const status = context.raw === 1 ? 'Active' : 'Inactive';
                            return context.dataset.label + ': ' + status;
                        }
                    }
                }
            }
        }
    });
}

// ユーティリティ関数
function showLoading(message) {
    const loadingElement = document.getElementById('loadingMessage');
    loadingElement.textContent = message;
    loadingElement.style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingMessage').style.display = 'none';
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    document.getElementById('loadingMessage').style.display = 'none';
}