const GEO_JSON_PATH = "data/globeCoordinates.json";
const DATA_CSV_PATH = "data/population.csv";
const GDP_CSV_PATH = "data/gdp.csv";
const FLAG_PATH = "./img/flags/";


const LOG_COLORS = [
    "#FFFFCC", // 第1档（最浅黄）
    "#FED976", // 第2档（浅橙黄）
    "#FEB24C", // 第3档（橙黄）
    "#FD8D3C", // 第4档（橙红）
    "#c21f1f", // 第5档（正红）
    "#5C1010"  // 第6档（深红）
];

// 硬编码分档范围（人口和GDP各6档）
const LOG_THRESHOLDS = {
    population: [1e4, 1e5, 1e6, 1e7, 1e8, 1e9], // 人口: 10^4 到 10^9
    gdp: [1e8, 1e9, 1e10, 1e11, 1e12, 1e13] // GDP: 10^8 到 10^13
};

const COLOR_NO_DATA = "#B2B2B2";
const COLOR_HOVER = "#D3D3D3";

const GLOBE_CONTAINER = d3.select("#globe-container");
let GLOBE_WIDTH = GLOBE_CONTAINER.node().getBoundingClientRect().width;
let GLOBE_HEIGHT = GLOBE_CONTAINER.node().getBoundingClientRect().height;
let GLOBE_RADIUS = GLOBE_HEIGHT / 2.8;
let GLOBE_CENTER = [GLOBE_WIDTH / 2, GLOBE_HEIGHT / 2];

const ROTATION_SENSITIVITY = 60;
const ZOOM_SENSITIVITY = 0.5;
let rotationTimer;
let isGlobeRotating = true;

let rotationSpeed = 0.2;
const MAX_ROTATION_SPEED = 6.0;
const MIN_ROTATION_SPEED = 0.0;

// 播放状态控制
let isPlaying = false;
let playSpeed = 350;
let lastTimestamp;
let animationFrameId;

// 主函数
async function drawGlobe() {
    const [geoJson, populationData, gdpData] = await Promise.all([
        d3.json(GEO_JSON_PATH),
        d3.csv(DATA_CSV_PATH),
        d3.csv(GDP_CSV_PATH)
    ]);

    let currentDataType = "population";
    let currentData = populationData;
    let filteredData = [];
    let logColorScale;
    let logThresholds;

    // 更新对数比例尺
    function updateLogScale() {
        logThresholds = LOG_THRESHOLDS[currentDataType];
        logColorScale = d3.scaleThreshold()
            .domain(logThresholds.slice(1))
            .range(LOG_COLORS);
    }

    const yearSlider = document.getElementById("year-slider");
    const yearDisplay = document.getElementById("year-display");
    const toolTip = d3.select("#tooltip");

    function clampToThresholds(value) {
        const thresholds = LOG_THRESHOLDS[currentDataType];
        return Math.max(thresholds[0], Math.min(value, thresholds[thresholds.length - 1]));
    }
    // 数据切换功能
    function handleDataToggle() {
        const type = this.dataset.type;
        if (type === currentDataType) return;

        d3.selectAll(".toggle-btn").classed("active", false);
        d3.select(this).classed("active", true);

        currentDataType = type;
        currentData = type === "population" ? populationData : gdpData;
        updateLogScale(currentData);
        updateYearRange(currentData);
        yearSlider.dispatchEvent(new Event('input'));
    }

    // 更新年份范围
    function updateYearRange(data) {
        const [minYear, maxYear] = d3.extent(data, d => +d.Year);
        yearSlider.min = minYear;
        yearSlider.max = maxYear;
        yearSlider.value = maxYear;
    }

    // 获取国家颜色
    function getCountryColor(country) {
        const countryData = filteredData.find(d => d['Country Code'] === country.id);
        if (!countryData) return COLOR_NO_DATA;

        const value = +countryData.Value;
        // 移除clampToThresholds调用，直接使用原始值
        return logColorScale(Math.max(value, LOG_THRESHOLDS[currentDataType][0]));
    }

    // 初始化地球
    const geoProjection = d3.geoOrthographic()
        .scale(GLOBE_RADIUS)
        .center([0, 0])
        .rotate([0, -25])
        .translate(GLOBE_CENTER);

    const initialScale = geoProjection.scale();
    const globeSvg = GLOBE_CONTAINER.append("svg")
        .attr("width", GLOBE_WIDTH)
        .attr("height", GLOBE_HEIGHT);

    globeSvg.append("circle")
        .attr("id", "globe")
        .attr("cx", GLOBE_WIDTH / 2)
        .attr("cy", GLOBE_HEIGHT / 2)
        .attr("r", geoProjection.scale())
        .style("fill", "#fde2bc")
        .style("stroke", "#000")
        .style("stroke-width", 0.5)
        .lower();

    const geoPathGenerator = d3.geoPath().projection(geoProjection);
    const globeMap = globeSvg.append("g");

    const countryPaths = globeMap.append("g")
        .attr("class", "countries")
        .selectAll("path")
        .data(geoJson.features)
        .enter().append("path")
        .attr("d", geoPathGenerator)
        .style("stroke", "#000")
        .style("stroke-width", "0.2px")
        .style("vector-effect", "non-scaling-stroke")
        .on("mouseover", function (country) {
            const element = d3.select(this);
            const currentColor = element.style("fill");
            const minValue = parseFloat(document.getElementById("min-value").value) || -Infinity;
            const maxValue = parseFloat(document.getElementById("max-value").value) || Infinity;
            const countryData = filteredData.find(d => d['Country Code'] === country.id);
            const displayValue = countryData ? +countryData.Value : null;
            const isInRange = displayValue ? displayValue >= minValue && displayValue <= maxValue : false;

            // 存储原始颜色作为数据属性
            element.attr("data-original-color", currentColor);

            if (isInRange) {
                // 满足筛选条件的国家 - 悬停时变灰
                element.style("fill", COLOR_HOVER);
            } else if (countryData) {
                // 不满足筛选条件但有数据的国家 - 悬停时显示原始颜色
                element.style("fill", logColorScale(displayValue));
            }
            showTooltip(country);
        })
        .on("mouseout", function (country) {
            const element = d3.select(this);
            // 恢复原始颜色
            element.style("fill", element.attr("data-original-color"));
            toolTip.style("display", "none");
        })
        .on("click", function (country) {
            // 停止地球旋转
            if (rotationTimer) rotationTimer.stop();
            isGlobeRotating = false;

            // 获取 globe-container 的尺寸和位置
            const globeContainer = document.getElementById('globe-container');
            const globeRect = globeContainer.getBoundingClientRect();

            // 创建详细工具提示容器
            const detailTooltip = d3.select("body").append("div")
                .attr("id", "detail-tooltip")
                .style("position", "fixed")
                .style("left", `${globeRect.left}px`)
                .style("top", `${globeRect.top}px`)
                .style("width", `${globeRect.width}px`)
                .style("height", `${globeRect.height}px`)
                .style("background", "rgba(0,0,0,0.7)")
                .style("z-index", "1000")
                .style("display", "flex")
                .style("justify-content", "center")
                .style("align-items", "center")
                .node();
            // 克隆模板并填充内容
            const template = document.getElementById('detail-tooltip-template');
            const clone = template.content.cloneNode(true);
            const activeType = document.querySelector('.toggle-btn.active').dataset.type;
            const year = document.getElementById('year-slider').value;
            clone.querySelector('.modal-title').textContent =
                `${country.properties.name_zh || country.properties.name} ${country.properties.name}`;
            clone.querySelector('iframe').src = `country.html?code=${country.id}&name=${country.properties.name}&type=${activeType}&year=${year}`;

            detailTooltip.appendChild(clone);

            // 添加关闭按钮事件
            d3.select(detailTooltip).select(".close-btn")
                .on("click", function () {
                    d3.select(detailTooltip).remove();
                    if (!isPlaying && isGlobeRotating) {
                        rotateGlobe(geoProjection, globeSvg, geoPathGenerator);
                    }
                });
        })

    // 显示工具提示
    function showTooltip(country) {
        const countryData = filteredData.find(d => d['Country Code'] === country.id);
        if (!countryData) return;

        // 计算经纬度范围
        const bbox = d3.geoBounds(country);
        const formatCoord = (coord, isLat) => {
            const absValue = Math.abs(coord).toFixed(1);
            const direction = isLat
                ? (coord >= 0 ? 'N' : 'S')
                : (coord >= 0 ? 'E' : 'W');
            return `${absValue}°${direction}`;
        };

        const minLon = formatCoord(bbox[0][0], false);
        const minLat = formatCoord(bbox[0][1], true);
        const maxLon = formatCoord(bbox[1][0], false);
        const maxLat = formatCoord(bbox[1][1], true);


        toolTip
            .style("display", "block")
            .style("left", `${d3.event.pageX + 15}px`)  // 保留版本1的15px偏移
            .style("top", `${d3.event.pageY + 15}px`);

        // 更新内容（同版本1）
        d3.select("#tooltip-country-name_zh").text(country.properties.name_zh);
        d3.select("#tooltip-country-name").text(country.properties.name);
        d3.select("#tooltip-flag").attr("src", `${FLAG_PATH}${country.id}.png`);
        // 添加经纬度信息
        d3.select("#tooltip-min-lon").text(minLon);
        d3.select("#tooltip-max-lon").text(maxLon);
        d3.select("#tooltip-min-lat").text(minLat);
        d3.select("#tooltip-max-lat").text(maxLat);

        // 保留版本1的智能数值格式化逻辑
        const value = +countryData.Value;
        let formattedValue;
        if (currentDataType === "population") {
            if (value >= 1e8) {
                formattedValue = `${d3.format(".2f")(value / 1e8)} 亿人`;
            } else if (value >= 1e4) {
                formattedValue = `${d3.format(".1f")(value / 1e4)} 万人`;
            } else {
                formattedValue = `${d3.format(",")(value)} 人`;
            }
        } else {
            if (value >= 1e12) {
                formattedValue = `$${d3.format(".2f")(value / 1e12)} 万亿`;
            } else if (value >= 1e8) {
                formattedValue = `$${d3.format(".2f")(value / 1e8)} 亿`;
            } else {
                formattedValue = `$${d3.format(",")(value)}`;
            }
        }

        // 显示格式化后的值
        d3.select("#tooltip-population")
            .text(currentDataType === "population" ? `人口: ${formattedValue}` : `GDP: ${formattedValue}`);
    }

    // 更新国家颜色
    function updateCountryColors() {
        const minValue = parseFloat(document.getElementById("min-value").value) || -Infinity;
        const maxValue = parseFloat(document.getElementById("max-value").value) || Infinity;

        countryPaths
            .attr("d", geoPathGenerator)
            .style("fill", country => {
                const countryData = filteredData.find(d => d['Country Code'] === country.id);
                if (!countryData) return COLOR_NO_DATA;

                const displayValue = +countryData.Value;
                const isInRange = displayValue >= minValue && displayValue <= maxValue;
                const valueToUse = Math.max(displayValue, LOG_THRESHOLDS[currentDataType][0]);
                return isInRange ? logColorScale(valueToUse) : COLOR_NO_DATA;
            });
    }

    // 绘制图例
    function drawLegend() {
        d3.select("#color-scale").selectAll("*").remove();
        const thresholds = LOG_THRESHOLDS[currentDataType];

        // 1. 创建渐变条
        const legendContainer = d3.select("#color-scale")
            .style("height", "20px")
            .style("padding", "0 5px"); // 通过 padding 控制边距

        // 渐变条容器，宽度与刻度线一致
        const gradientContainer = legendContainer.append("div")
            .style("height", "15px")
            .style("width", "100%") // 宽度由父容器的 padding 控制
            .style("background", `linear-gradient(to right, ${LOG_COLORS.join(",")}`);

        // 2. 添加刻度轴
        const legendSvg = legendContainer.append("svg")
            .style("width", "100%") // 宽度与渐变条一致
            .style("height", "25px");

        // 计算实际可用宽度（减去 padding）
        const legendWidth = legendContainer.node().getBoundingClientRect().width - 10; // 减去左右 padding

        const xScale = d3.scaleLog()
            .domain([thresholds[0], thresholds[thresholds.length - 1]])
            .range([0, legendWidth]);

        legendSvg.append("g")
            .attr("transform", "translate(0, 0)")
            .call(d3.axisBottom(xScale)
                .tickValues(thresholds)
                .tickFormat(d => {
                    const power = Math.log10(d);
                    return power % 1 === 0 ? `10^${power}` : d3.format(".1e")(d);
                })
                .tickSize(8))
            .selectAll(".tick text")
            .style("font-size", "10px")
            .style("text-anchor", "middle");
    }

    // 滑块事件
    function handleYearSliderInput() {
        const selectedYear = this.value;
        yearDisplay.textContent = selectedYear;

        filteredData = currentData.filter(d => d.Year === selectedYear);

        d3.select("#page-title").text(
            currentDataType === "population" ? "世界人口" : "世界GDP(美元)"
        );

        drawLegend();
        updateCountryColors();
    }

    // 交互功能
    function createDrag(geoProjection, globeSvg, geoPathGenerator) {
        return d3.drag()
            .on("start", () => rotationTimer.stop())
            .on("drag", () => {
                const rotate = geoProjection.rotate();
                const k = ROTATION_SENSITIVITY / geoProjection.scale();
                geoProjection.rotate([rotate[0] + d3.event.dx * k, rotate[1] - d3.event.dy * k]);
                globeSvg.selectAll("path").attr("d", geoPathGenerator);
            })
            .on("end", () => isGlobeRotating && rotateGlobe(geoProjection, globeSvg, geoPathGenerator));
    }

    function configureZoom(initialScale, geoProjection) {
        return d3.zoom()
            .scaleExtent([ZOOM_SENSITIVITY, 10])
            .on('zoom', () => {
                geoProjection.scale(initialScale * d3.event.transform.k);
                globeSvg.selectAll("path").attr("d", d3.geoPath().projection(geoProjection));
                globeSvg.select("#globe").attr("r", geoProjection.scale());
            });
    }

    // 自动旋转
    function rotateGlobe(geoProjection, globeSvg, geoPathGenerator) {
        if (rotationTimer) rotationTimer.stop();
        rotationTimer = d3.timer(elapsed => {
            const rotate = geoProjection.rotate();
            geoProjection.rotate([rotate[0] - rotationSpeed * 0.2, rotate[1]]);
            globeSvg.selectAll("path").attr("d", geoPathGenerator);
        });
    }

    // 范围搜索功能
    function handleApplyRange() {
        const min = parseFloat(document.getElementById("min-value").value) || 0;
        const max = parseFloat(document.getElementById("max-value").value) || Infinity;

        countryPaths.style("fill", country => {
            const countryData = filteredData.find(d => d['Country Code'] === country.id);
            const value = countryData ? +countryData.Value : null;
            return value && value >= min && value <= max ? getCountryColor(country) : COLOR_NO_DATA;
        });
    }

    function handleResetRange() {
        document.getElementById("min-value").value = "";
        document.getElementById("max-value").value = "";
        updateCountryColors();
    }

    // 播放控制
    function togglePlay() {
        if (!isPlaying) {
            const yearSlider = document.getElementById('year-slider');
            if (+yearSlider.value >= +yearSlider.max) {
                yearSlider.value = yearSlider.min;
                yearSlider.dispatchEvent(new Event('input'));
            }

            isPlaying = true;
            document.getElementById('play-icon').setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
            lastTimestamp = performance.now();
            animationFrameId = requestAnimationFrame(animatePlay);
        } else {
            isPlaying = false;
            cancelAnimationFrame(animationFrameId);
            document.getElementById('play-icon').setAttribute('d', 'M8 5v14l11-7z');
        }
    }

    function animatePlay(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const elapsed = timestamp - lastTimestamp;

        if (elapsed >= playSpeed) {
            const yearSlider = document.getElementById('year-slider');
            if (+yearSlider.value < +yearSlider.max) {
                yearSlider.value = +yearSlider.value + 1;
                yearSlider.dispatchEvent(new Event('input'));
                lastTimestamp = timestamp;
            } else {
                // 到达最后一年时停止播放
                togglePlay();
            }
        }
        if (isPlaying) {
            animationFrameId = requestAnimationFrame(animatePlay);
        }
    }

    function debugLog(message, data = null) {
        console.log(`[DEBUG] ${message}`, data || '');
    }
    async function setupCountrySearch() {
        const searchInput = document.getElementById('country-search');
        const searchButton = document.getElementById('search-button');
        const originalColors = new Map();

        // 调试日志函数

        function restoreColors() {
            globeSvg.selectAll(".countries path").each(function (d) {
                const originalColor = originalColors.get(d.id);
                if (originalColor) {
                    d3.select(this).style("fill", originalColor);
                }
            });
        }

        async function handleAISearch(query) {
            try {
                debugLog("开始AI查询", { query });
                searchButton.disabled = true;
                searchButton.textContent = "AI识别中...";

                const aiResponse = await queryAI(`必须回答出国家名称(如果主观问题，就以你自己的立场回答)，且只回答一个国家名称: ${query}`);
                debugLog("AI响应结果", aiResponse);

                if (!aiResponse) {
                    throw new Error("AI未返回有效结果");
                }

                const matchedCountry = geoJson.features.find(country => {
                    const name = country.properties.name.toLowerCase();
                    const nameZh = (country.properties.name_zh || '').toLowerCase();
                    const aiName = aiResponse.toLowerCase();
                    return name === aiName || nameZh === aiName;
                });

                if (!matchedCountry) {
                    throw new Error(`未找到匹配的国家: ${aiResponse}`);
                }

                return matchedCountry;
            } catch (error) {
                debugLog("AI查询出错", error);
                alert(error.message);
                return null;
            } finally {
                searchButton.disabled = false;
                searchButton.textContent = "定位";
            }
        }

        function highlightAndRotate(country) {
            debugLog("开始高亮并旋转到国家", country.properties.name);

            if (rotationTimer) rotationTimer.stop();
            isGlobeRotating = false;

            // 存储原始颜色
            globeSvg.selectAll(".countries path").each(function (d) {
                originalColors.set(d.id, d3.select(this).style("fill"));
            });

            // 应用高亮
            globeSvg.selectAll(".countries path")
                .style("fill", d => d.id === country.id
                    ? originalColors.get(d.id)
                    : COLOR_NO_DATA);

            const centroid = d3.geoCentroid(country);
            const rotate = geoProjection.rotate();
            const targetRotation = [-centroid[0], -centroid[1]];
            const targetScale = initialScale * 3.2;

            // 更新缩放行为
            globeSvg.call(configureZoom(targetScale, geoProjection));

            d3.transition()
                .duration(1200)
                .tween("rotate", function () {
                    const r = d3.interpolate(rotate, targetRotation);
                    const s = d3.interpolate(geoProjection.scale(), targetScale);
                    return function (t) {
                        geoProjection.rotate(r(t)).scale(s(t));
                        globeSvg.selectAll("path").attr("d", geoPathGenerator);
                        globeSvg.select("#globe").attr("r", geoProjection.scale());
                    };
                })
                .on("end", () => {
                    setTimeout(restoreColors, 1200);
                });
        }

        async function searchAndRotate() {
            const query = searchInput.value.trim();
            if (!query) return;

            debugLog("开始搜索", { query });

            // 首先尝试精确匹配
            let matchedCountry = geoJson.features.find(country => {
                const name = country.properties.name.toLowerCase();
                const nameZh = (country.properties.name_zh || '').toLowerCase();
                const queryLower = query.toLowerCase();
                return name.includes(queryLower) || nameZh.includes(queryLower);
            });

            if (matchedCountry) {
                highlightAndRotate(matchedCountry);
                return;
            }

            // 精确匹配失败时使用AI
            debugLog("精确匹配失败，尝试AI识别");
            matchedCountry = await handleAISearch(query);

            if (matchedCountry) {
                highlightAndRotate(matchedCountry);
            }
        }

        // 事件监听器（只绑定一次）
        searchButton.addEventListener('click', searchAndRotate);
        searchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') searchAndRotate();
        });
    }

    async function queryAI(question) {
        try {
            debugLog("调用AI API", { question });
            const response = await fetch('http://localhost:8080/ask_ai/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question })
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();
            debugLog("API响应数据", data);

            if (data.error) {
                throw new Error(data.error);
            }

            return data.answer;
        } catch (error) {
            debugLog("API调用出错", error);
            throw error;
        }
    }


    // 初始化对数比例尺
    updateLogScale(currentData);
    setupCountrySearch();

    // 初始化事件监听器
    d3.selectAll(".toggle-btn").on("click", handleDataToggle);
    yearSlider.addEventListener("input", handleYearSliderInput);
    globeSvg.call(createDrag(geoProjection, globeSvg, geoPathGenerator))
        .call(configureZoom(initialScale, geoProjection));
    rotateGlobe(geoProjection, globeSvg, geoPathGenerator);
    yearSlider.dispatchEvent(new Event('input'));

    const rotationSpeedSlider = document.getElementById("rotation-speed");
    rotationSpeedSlider.value = 20;
    rotationSpeedSlider.addEventListener("input", function () {
        rotationSpeed = MIN_ROTATION_SPEED + (MAX_ROTATION_SPEED - MIN_ROTATION_SPEED) * (this.value / 100);
        if (isGlobeRotating) {
            rotateGlobe(geoProjection, globeSvg, geoPathGenerator);
        }
    });

    document.getElementById('play-button').addEventListener('click', togglePlay);
    document.getElementById('play-speed').addEventListener('input', function () {
        // 线性映射：0-100 -> 1.0x-10.0x
        const displaySpeed = (1 + (this.value / 100) * 9).toFixed(1); // 1.0-10.0

        // 计算实际播放间隔时间（反向关系）
        playSpeed = 550 - (this.value * 5); // 550ms到50ms

        // 更新显示
        document.getElementById('speed-display').textContent = displaySpeed + 'x';
    });

    document.getElementById("apply-range").addEventListener("click", handleApplyRange);
    document.getElementById("reset-range").addEventListener("click", handleResetRange);

    // 添加按空格暂停逻辑
    document.addEventListener('keydown', function (event) {
        // 检查当前焦点是否在输入框内
        const activeElement = document.activeElement;
        const isInputFocused = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';

        // 如果是空格键且不在输入框中，才触发暂停
        if (event.code === 'Space' && !isInputFocused) {
            event.preventDefault();
            if (isGlobeRotating) {
                rotationTimer.stop();
            } else {
                rotateGlobe(geoProjection, globeSvg, geoPathGenerator);
            }
            isGlobeRotating = !isGlobeRotating;
        }
    });
}

// 监听按钮事件，向 country.html 发送数据类型
document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type }, '*');
        }
    });
});

// 监听滑动条事件，向 country.html 发送年份
document.getElementById('year-slider').addEventListener('input', () => {
    const year = document.getElementById('year-slider').value;
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ year }, '*');
    }
});

// 初始化
drawGlobe();