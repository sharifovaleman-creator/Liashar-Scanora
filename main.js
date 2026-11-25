// =====================================
// SCANORA - SUPABASE CONNECTION
// =====================================

const SUPABASE_URL = "https://wwwwqmrkdiafdbxxcpnm.supabase.co";
const SUPABASE_KEY = "sb_publishable_hPPyr4WHUS0Di1Y-fd6KNA_vWQJb1jU";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// =====================================
// ELEMENTS
// =====================================

const menu = document.getElementById("menu");
const mainButton = document.getElementById("mainButton");

const scanButton = document.getElementById("scanButton");
const cameraModal = document.getElementById("cameraModal");
const cameraMessage = document.getElementById("cameraMessage");
const closeCamera = document.getElementById("closeCamera");
const manualBarcodeButton = document.getElementById("manualBarcodeButton");

const productList = document.getElementById("productList");
const productForm = document.getElementById("productForm");
const productModal = document.getElementById("productModal");

const formBarcode = document.getElementById("formBarcode");
const formName = document.getElementById("formName");
const formDate = document.getElementById("formDate");
const cancelButton = document.getElementById("cancelButton");

const productSearch = document.getElementById("productSearch");
const clearSearch = document.getElementById("clearSearch");
const productSort = document.getElementById("productSort");
const productCount = document.getElementById("productCount");
const emptyProducts = document.getElementById("emptyProducts");

const filterButtons = document.querySelectorAll(".filter-btn");

const expiredSection = document.getElementById("expiredSection");
const expiredProductList = document.getElementById("expiredProductList");
const expiredCount = document.getElementById("expiredCount");

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const logoutButton = document.getElementById("logoutButton");

const loginEmail = "sharifovaleman195@gmail.com";

let activeFilter = "all";
let products = [];
let productsChannel = null;

// =====================================
// ARCHIVE SECTION - AUTO CREATE
// =====================================

function createArchiveSection() {
    let section = document.getElementById("archiveSection");

    if (section) return section;

    section = document.createElement("section");
    section.id = "archiveSection";
    section.className = "archive-section";

    section.innerHTML = `
        <div class="archive-header">
            <div>
                <h2>არქივი</h2>
                <span id="archiveCount">0 პროდუქტი</span>
            </div>

            <button
                type="button"
                id="archiveClearAll"
                class="archive-clear-all"
            >
                ყველას წაშლა
            </button>
        </div>

        <div id="archiveProductList"></div>

        <p id="emptyArchive" hidden>
            არქივი ცარიელია.
        </p>
    `;

    if (expiredSection) {
        expiredSection.insertAdjacentElement("afterend", section);
    } else if (productList) {
        productList.insertAdjacentElement("afterend", section);
    } else {
        document.body.appendChild(section);
    }

    return section;
}

const archiveSection = createArchiveSection();
const archiveProductList = document.getElementById("archiveProductList");
const archiveCount = document.getElementById("archiveCount");
const archiveClearAll = document.getElementById("archiveClearAll");
const emptyArchive = document.getElementById("emptyArchive");

// =====================================
// MENU
// =====================================

mainButton.addEventListener("click", () => {
    menu.classList.toggle("active");
    mainButton.classList.toggle("active");

    const isOpen = menu.classList.contains("active");
    mainButton.setAttribute("aria-expanded", isOpen);
});

// =====================================
// AUTH
// =====================================

async function checkLogin() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Session error:", error);
        loginScreen.style.display = "flex";
        return;
    }

    if (data.session) {
        loginScreen.style.display = "none";
        await loadDatabase();
    } else {
        loginScreen.style.display = "flex";
    }
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    loginError.textContent = "მოწმდება...";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword.value
    });

    if (error) {
        loginError.textContent = "ელფოსტა ან პაროლი არასწორია!";
        loginPassword.value = "";
        return;
    }

    loginPassword.value = "";
    loginError.textContent = "";
    loginScreen.style.display = "none";

    // Girişdən sonra məlumatları yüklə
    await loadDatabase();
});

logoutButton.addEventListener("click", async () => {
    if (!confirm("გსურთ სისტემიდან გამოსვლა?")) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("გასვლისას მოხდა შეცდომა.");
        return;
    }

    location.reload();
});

// =====================================
// DATABASE - SUPABASE
// =====================================

async function refreshProducts() {
    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("expiry_date", { ascending: true });

    if (error) {
        console.error("Refresh error:", error);
        alert("მონაცემების ჩატვირთვა ვერ მოხერხდა.");
        return;
    }

    products = (data || []).map(row => ({
        id: row.id,
        barcode: String(row.barcode),
        name: row.name,
        date: row.expiry_date,
        status: row.status || "active"
    }));

    renderProducts();
}

function startRealtimeSync() {
    if (productsChannel) {
        supabaseClient.removeChannel(productsChannel);
    }

    productsChannel = supabaseClient
        .channel("scanora-products-sync")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "products"
            },
            () => refreshProducts()
        )
        .subscribe(status => {
            console.log("Realtime status:", status);
        });
}

async function loadDatabase() {
    try {
        await refreshProducts();
        startRealtimeSync();
    } catch (error) {
        console.error("Database error:", error);
        alert("მონაცემების ჩატვირთვისას მოხდა შეცდომა.");
    }
}

// =====================================
// SAVE LOCAL COPY
// =====================================

function saveDatabase() {
    localStorage.setItem(
        "scanora_products",
        JSON.stringify(products)
    );

    renderProducts();
}

// =====================================
// QUAGGA2 BARCODE SCANNER
// =====================================

let scannerRunning = false;
let barcodeDetected = false;
let lastBarcode = "";
let barcodeCount = 0;

scanButton.addEventListener("click", startCamera);

async function checkCameras() {
    let stream;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        const devices = await navigator.mediaDevices.enumerateDevices();

        return devices.filter(device =>
            device.kind === "videoinput"
        );

    } catch (error) {
        cameraMessage.textContent = "კამერის შეცდომა: " + error.message;
        return [];

    } finally {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
}

async function startCamera() {
    cameraModal.classList.add("show");
    cameraMessage.textContent = "კამერა მზადდება...";

    barcodeDetected = false;
    lastBarcode = "";
    barcodeCount = 0;

    if (scannerRunning) {
        stopCamera();
    }

    const cameras = await checkCameras();

    if (!cameras.length) {
        cameraMessage.textContent = "კამერა ვერ მოიძებნა!";
        return;
    }

    // Əvvəl Camera 0 axtarılır, tapılmasa ilk kamera seçilir
    const selectedCamera =
        cameras.find(camera =>
            camera.label.toLowerCase().includes("camera 0")
        ) || cameras[0];

    if (typeof Quagga === "undefined") {
        cameraMessage.textContent = "სკანერი ვერ ჩაიტვირთა!";
        return;
    }

    Quagga.init({
        inputStream: {
            name: "Scanora Camera",
            type: "LiveStream",
            target: document.querySelector("#scanner-container"),

            constraints: {
                deviceId: {
                    exact: selectedCamera.deviceId
                },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },

            area: {
                top: "15%",
                right: "5%",
                left: "5%",
                bottom: "15%"
            }
        },

        locator: {
            patchSize: "medium",
            halfSample: false
        },

        frequency: 10,

        decoder: {
            readers: [
                "ean_reader",
                "ean_8_reader",
                "code_128_reader",
                "upc_reader",
                "upc_e_reader"
            ],
            multiple: false
        },

        locate: true

    }, function(error) {
        if (error) {
            console.error("Quagga error:", error);
            cameraMessage.textContent = "კამერა ვერ გაიხსნა!";
            return;
        }

        Quagga.onDetected(handleBarcode);
        Quagga.start();

        setTimeout(async () => {
            try {
                const track = Quagga.CameraAccess.getActiveTrack();

                if (!track) return;

                const capabilities = track.getCapabilities();

                if (
                    capabilities.focusMode &&
                    capabilities.focusMode.includes("continuous")
                ) {
                    await track.applyConstraints({
                        advanced: [
                            { focusMode: "continuous" }
                        ]
                    });

                    console.log("Auto focus aktivdir!");
                }
            } catch (error) {
                console.log("Focus error:", error);
            }
        }, 1000);

        scannerRunning = true;
        cameraMessage.textContent = "შტრიხკოდის მოლოდინში...";
    });
}

function handleBarcode(result) {
    if (barcodeDetected) return;
    if (!result || !result.codeResult) return;

    const barcode = result.codeResult.code;

    if (!barcode) return;

    if (barcode === lastBarcode) {
        barcodeCount++;
    } else {
        lastBarcode = barcode;
        barcodeCount = 1;
    }

    cameraMessage.textContent = "შტრიხკოდი მოწმდება: " + barcode;

    if (barcodeCount < 2) return;

    barcodeDetected = true;

    stopCamera();
    cameraModal.classList.remove("show");

    searchProduct(barcode);
}

function stopCamera() {
    if (typeof Quagga !== "undefined") {
        Quagga.offDetected(handleBarcode);

        if (scannerRunning) {
            Quagga.stop();
        }
    }

    scannerRunning = false;
}

closeCamera.addEventListener("click", () => {
    stopCamera();
    cameraModal.classList.remove("show");
});

manualBarcodeButton.addEventListener("click", () => {
    stopCamera();
    cameraModal.classList.remove("show");
    openProductForm("");
});

// =====================================
// PRODUCT SEARCH BY BARCODE
// =====================================

function searchProduct(barcode) {
    barcode = String(barcode).trim();

    if (!barcode) return;

    openProductForm(barcode);
}

// =====================================
// OPEN PRODUCT FORM
// =====================================

function openProductForm(barcode) {
    const existingProduct = products.find(product =>
        product.barcode === String(barcode)
    );

    formBarcode.value = barcode;

    if (existingProduct) {
        formName.value = existingProduct.name;
        formName.readOnly = true;
    } else {
        formName.value = "";
        formName.readOnly = false;
    }

    formDate.value = "";
    productModal.classList.add("show");
}

formBarcode.addEventListener("input", () => {
    const barcode = formBarcode.value.trim();

    const existingProduct = products.find(product =>
        product.barcode === barcode
    );

    if (existingProduct) {
        formName.value = existingProduct.name;
        formName.readOnly = true;
    } else {
        formName.value = "";
        formName.readOnly = false;
    }
});

// =====================================
// SAVE PRODUCT - SUPABASE
// =====================================

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const barcode = formBarcode.value.trim();
    const name = formName.value.trim();
    const date = formDate.value;

    if (!barcode || !name || !date) {
        alert("შეავსეთ ყველა ველი!");
        return;
    }

    const alreadyExists = products.some(product =>
        product.barcode === barcode &&
        product.date === date
    );

    if (alreadyExists) {
        alert("ამ პროდუქტის ამ თარიღის ჩანაწერი უკვე არსებობს!");
        return;
    }

    const submitButton = productForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) submitButton.disabled = true;

    try {
        const { error } = await supabaseClient
            .from("products")
            .insert({
                barcode,
                name,
                expiry_date: date,
                status: "active"
            });

        if (error) {
            if (error.code === "23505") {
                alert("ამ პროდუქტის ამ თარიღის ჩანაწერი უკვე არსებობს!");
            } else {
                console.error("Save error:", error);
                alert("პროდუქტის შენახვა ვერ მოხერხდა!");
            }

            return;
        }

        await refreshProducts();

        productModal.classList.remove("show");
        productForm.reset();
        formName.readOnly = false;

        alert("პროდუქტი წარმატებით შეინახა!");

    } catch (error) {
        console.error("Save error:", error);
        alert("პროდუქტის შენახვა ვერ მოხერხდა!");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

// =====================================
// CANCEL BUTTON
// =====================================

cancelButton.addEventListener("click", () => {
    productModal.classList.remove("show");
    productForm.reset();
    formName.readOnly = false;
});

// =====================================
// EXPIRY DATE STATUS
// =====================================

function getExpiryInfo(date) {
    const [year, month, day] = date.split("-").map(Number);

    const today = new Date();

    const todayUTC = Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    const expiryUTC = Date.UTC(year, month - 1, day);

    const difference = Math.round(
        (expiryUTC - todayUTC) / 86400000
    );

    if (difference <= 0) {
        return {
            className: "status-red",
            label: difference === 0
                ? "დღეს ბოლო დღეა"
                : "ვადაგასულია",
            difference
        };
    }

    if (difference <= 3) {
        return {
            className: "status-orange",
            label: `დარჩა ${difference} დღე`,
            difference
        };
    }

    if (difference <= 7) {
        return {
            className: "status-yellow",
            label: `დარჩა ${difference} დღე`,
            difference
        };
    }

    return {
        className: "status-green",
        label: "ნორმალური",
        difference
    };
}

// =====================================
// FORMAT DATE
// =====================================

function formatDate(date) {
    const [year, month, day] = date.split("-");
    return `${day}.${month}.${year}`;
}

// =====================================
// HTML SECURITY
// =====================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// =====================================
// GROUP PRODUCTS BY BARCODE
// =====================================

function groupProducts(items) {
    const groups = new Map();

    items.forEach(product => {
        const key = String(product.barcode);

        if (!groups.has(key)) {
            groups.set(key, {
                barcode: product.barcode,
                name: product.name,
                dates: []
            });
        }

        groups.get(key).dates.push(product);
    });

    return Array.from(groups.values()).map(group => {
        group.dates.sort((a, b) =>
            a.date.localeCompare(b.date)
        );

        group.nearestDate = group.dates[0]?.date || "";
        group.expiry = group.nearestDate
            ? getExpiryInfo(group.nearestDate)
            : null;

        return group;
    });
}

// =====================================
// SORT PRODUCT GROUPS
// =====================================

function sortProductItems(items) {
    const sorted = [...items];

    if (productSort.value === "nearest") {
        sorted.sort((a, b) =>
            a.nearestDate.localeCompare(b.nearestDate)
        );
    } else if (productSort.value === "farthest") {
        sorted.sort((a, b) =>
            b.nearestDate.localeCompare(a.nearestDate)
        );
    } else if (productSort.value === "az") {
        sorted.sort((a, b) =>
            a.name.localeCompare(b.name, "az")
        );
    } else if (productSort.value === "za") {
        sorted.sort((a, b) =>
            b.name.localeCompare(a.name, "az")
        );
    }

    return sorted;
}

// =====================================
// CREATE DATE ROW
// =====================================

function createDateRow(product, isArchived = false) {
    const row = document.createElement("div");

    row.className = "expiry-date-row";
    row.dataset.id = product.id;

    const expiry = getExpiryInfo(product.date);

    row.innerHTML = `
        <div class="expiry-date-info">
            <span class="expiry-date-label">
                ${isArchived ? "არქივის თარიღი" : "ვარგისიანობის ვადა"}
            </span>

            <strong class="expiry-date-value">
                ${formatDate(product.date)}
            </strong>

            ${!isArchived ? `
                <span class="expiry-date-status ${expiry.className}">
                    ${expiry.label}
                </span>
            ` : ""}
        </div>

        <div class="date-actions" hidden>
            ${!isArchived ? `
                <button
                    type="button"
                    class="date-action archive-date"
                    data-id="${escapeHTML(product.id)}"
                >
                    თაროდან მოხსნა
                </button>
            ` : ""}

            <button
                type="button"
                class="date-action delete-date"
                data-id="${escapeHTML(product.id)}"
            >
                წაშლა
            </button>
        </div>
    `;

    return row;
}

// =====================================
// CREATE PRODUCT CARD
// =====================================

function createProductCard(group, isArchived = false) {
    const card = document.createElement("div");

    const statusClass = group.expiry
        ? group.expiry.className
        : "";

    card.className = isArchived
        ? "product-card archive-product-card"
        : `product-card ${statusClass}`;

    const dateRows = group.dates.map(product =>
        createDateRow(product, isArchived).outerHTML
    ).join("");

    card.innerHTML = `
        <div class="product-card-top">
            <h3>${escapeHTML(group.name)}</h3>

            <span class="product-status">
                ${isArchived
                    ? "არქივში"
                    : group.expiry.label}
            </span>
        </div>

        <div class="product-barcode">
            <span>შტრიხკოდის ნომერი</span>
            <strong>${escapeHTML(group.barcode)}</strong>
        </div>

        <div class="product-expiry-list">
            ${dateRows}
        </div>
    `;

    return card;
}

// =====================================
// LONG PRESS - SHOW / HIDE DATE ACTIONS
// =====================================

const longPressTimers = new Map();
const LONG_PRESS_TIME = 550;

let selectedDateRow = null;

function closeDateActions() {
    document.querySelectorAll(".expiry-date-row").forEach(row => {
        const actions = row.querySelector(".date-actions");

        if (actions) {
            actions.hidden = true;
        }

        row.classList.remove("date-selected");
    });

    selectedDateRow = null;
}

function startLongPress(event) {
    const row = event.target.closest(".expiry-date-row");

    if (!row) return;

    if (event.target.closest(".date-action")) return;

    const id = row.dataset.id;

    clearTimeout(longPressTimers.get(id));

    const timer = setTimeout(() => {

        // Eyni tarix açıqdırsa, bağla
        if (selectedDateRow === row) {
            closeDateActions();
            longPressTimers.delete(id);
            return;
        }

        // Əvvəlki tarixi bağla
        closeDateActions();

        // Yeni tarixi aç
        const actions = row.querySelector(".date-actions");

        if (actions) {
            actions.hidden = false;
            row.classList.add("date-selected");
            selectedDateRow = row;
        }

        if (navigator.vibrate) {
            navigator.vibrate(40);
        }

        longPressTimers.delete(id);

    }, LONG_PRESS_TIME);

    longPressTimers.set(id, timer);
}

function cancelLongPress(event) {
    const row = event.target.closest(".expiry-date-row");

    if (!row) return;

    const id = row.dataset.id;

    clearTimeout(longPressTimers.get(id));
    longPressTimers.delete(id);
}

function setupLongPress(container) {
    if (!container) return;

    container.addEventListener("pointerdown", startLongPress);
    container.addEventListener("pointerup", cancelLongPress);
    container.addEventListener("pointerleave", cancelLongPress);
    container.addEventListener("pointercancel", cancelLongPress);

    // Açıq tarixə adi kliklə yenidən basanda bağla
    container.addEventListener("click", event => {
        const row = event.target.closest(".expiry-date-row");

        if (!row) {
            closeDateActions();
            return;
        }

        if (event.target.closest(".date-action")) return;

        if (selectedDateRow === row) {
            closeDateActions();
        }
    });

    container.addEventListener("contextmenu", event => {
        if (event.target.closest(".expiry-date-row")) {
            event.preventDefault();
        }
    });
}

setupLongPress(productList);
setupLongPress(expiredProductList);
setupLongPress(archiveProductList);

// =====================================
// ARCHIVE ONE DATE
// =====================================

async function archiveProduct(id, button) {
    const approved = confirm(
        "გსურთ ამ თარიღის არქივში გადატანა?"
    );

    if (!approved) return;

    button.disabled = true;

    try {
        const { error } = await supabaseClient
            .from("products")
            .update({ status: "archived" })
            .eq("id", id);

        if (error) throw error;

        await refreshProducts();

    } catch (error) {
        console.error("Archive error:", error);
        alert("თარიღის არქივში გადატანა ვერ მოხერხდა!");
        button.disabled = false;
    }
}

// =====================================
// DELETE ONE DATE
// =====================================

async function deleteProductDate(id, button) {
    const approved = confirm(
        "ეს თარიღი ბაზიდან სამუდამოდ წაიშალოს?"
    );

    if (!approved) return;

    button.disabled = true;

    try {
        const { error } = await supabaseClient
            .from("products")
            .delete()
            .eq("id", id);

        if (error) throw error;

        await refreshProducts();

    } catch (error) {
        console.error("Delete error:", error);
        alert("თარიღის წაშლა ვერ მოხერხდა!");
        button.disabled = false;
    }
}

// =====================================
// DATE ACTIONS
// =====================================

async function handleDateAction(event) {
    const archiveButton = event.target.closest(".archive-date");
    const deleteButton = event.target.closest(".delete-date");

    if (archiveButton) {
        await archiveProduct(
            archiveButton.dataset.id,
            archiveButton
        );
        return;
    }

    if (deleteButton) {
        await deleteProductDate(
            deleteButton.dataset.id,
            deleteButton
        );
    }
}

productList.addEventListener("click", handleDateAction);
expiredProductList.addEventListener("click", handleDateAction);
archiveProductList.addEventListener("click", handleDateAction);

// =====================================
// DELETE ALL ARCHIVED PRODUCTS
// =====================================

archiveClearAll.addEventListener("click", async () => {
    const archivedProducts = products.filter(product =>
        product.status === "archived"
    );

    if (!archivedProducts.length) {
        alert("არქივი უკვე ცარიელია.");
        return;
    }

    const approved = confirm(
        `არქივში არსებული ${archivedProducts.length} თარიღი მთლიანად სამუდამოდ წაიშალოს? ეს მოქმედება შეუქცევადია!`
    );

    if (!approved) return;

    archiveClearAll.disabled = true;

    try {
        const { error } = await supabaseClient
            .from("products")
            .delete()
            .eq("status", "archived");

        if (error) throw error;

        await refreshProducts();

        alert("არქივი სრულად გასუფთავდა!");

    } catch (error) {
        console.error("Archive clear error:", error);
        alert("არქივის გასუფთავება ვერ მოხერხდა!");
    } finally {
        archiveClearAll.disabled = false;
    }
});

// =====================================
// RENDER PRODUCTS
// =====================================

function renderProducts() {
    if (!productList) return;

    const searchText = productSearch.value
        .trim()
        .toLowerCase();

    const activeProducts = products.filter(product =>
        product.status !== "archived"
    );

    const archivedProducts = products.filter(product =>
        product.status === "archived"
    );

    // Axtarış: aktiv məhsullar
    const searchedActive = activeProducts.filter(product => {
        const name = String(product.name || "").toLowerCase();
        const barcode = String(product.barcode || "").toLowerCase();

        return name.includes(searchText) ||
            barcode.includes(searchText);
    });

    // Axtarış: arxiv
    const searchedArchived = archivedProducts.filter(product => {
        const name = String(product.name || "").toLowerCase();
        const barcode = String(product.barcode || "").toLowerCase();

        return name.includes(searchText) ||
            barcode.includes(searchText);
    });

    // Məhsulları qruplaşdır
    const activeGroups = groupProducts(searchedActive);
    const archivedGroups = groupProducts(searchedArchived);

    // Rəng filtrinə görə məhsulları seç
    let filteredGroups = activeGroups.filter(group => {
        const status = group.expiry.className;

        if (activeFilter === "all") {
            return status !== "status-red";
        }

        return status === "status-" + activeFilter;
    });

    // Vaxtı keçmiş məhsullar
    const expiredGroups = activeGroups.filter(group =>
        group.expiry.className === "status-red"
    );

    filteredGroups = sortProductItems(filteredGroups);

    const sortedExpired = sortProductItems(expiredGroups);
    const sortedArchived = sortProductItems(archivedGroups);

    // Aktiv məhsullar
    productList.innerHTML = "";

    filteredGroups.forEach(group => {
        productList.appendChild(createProductCard(group));
    });

    // Vaxtı keçmiş məhsullar
    expiredProductList.innerHTML = "";

    sortedExpired.forEach(group => {
        expiredProductList.appendChild(createProductCard(group));
    });

    // Arxiv məhsulları
    archiveProductList.innerHTML = "";

    sortedArchived.forEach(group => {
        archiveProductList.appendChild(
            createProductCard(group, true)
        );
    });

    // Saylar
    const activeDateCount = filteredGroups.reduce(
        (total, group) => total + group.dates.length,
        0
    );

    const expiredDateCount = sortedExpired.reduce(
        (total, group) => total + group.dates.length,
        0
    );

    const archivedDateCount = sortedArchived.reduce(
        (total, group) => total + group.dates.length,
        0
    );

    productCount.textContent =
        `${filteredGroups.length} პროდუქტი · ${activeDateCount} თარიღი`;

    expiredCount.textContent =
        `${expiredGroups.length} პროდუქტი · ${expiredDateCount} თარიღი`;

    archiveCount.textContent =
        `${sortedArchived.length} პროდუქტი · ${archivedDateCount} თარიღი`;

    // Bölmələrin görünməsi
    expiredSection.hidden =
        activeFilter !== "all" || expiredGroups.length === 0;

    archiveSection.hidden = archivedGroups.length === 0;

    emptyArchive.hidden = archivedGroups.length !== 0;

    emptyProducts.hidden =
        filteredGroups.length > 0 ||
        (activeFilter === "all" && expiredGroups.length > 0);
}

// =====================================
// SEARCH
// =====================================

productSearch.addEventListener("input", renderProducts);

clearSearch.addEventListener("click", () => {
    productSearch.value = "";
    renderProducts();
});

// =====================================
// FILTER BUTTONS
// =====================================

filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        filterButtons.forEach(btn =>
            btn.classList.remove("active")
        );

        button.classList.add("active");

        activeFilter = button.dataset.filter;

        renderProducts();
    });
});

// =====================================
// SORT
// =====================================

productSort.addEventListener("change", renderProducts);

// =====================================
// INITIALIZE
// =====================================

checkLogin();

