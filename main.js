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
// ELEMENTLƏR
// =====================================

const menu = document.getElementById("menu");
const mainButton = document.getElementById("mainButton");

const scanButton = document.getElementById("scanButton");
const cameraModal = document.getElementById("cameraModal");
const video = document.getElementById("video");
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
        console.error("სესიის შეცდომა:", error);
        loginScreen.style.display = "flex";
        return;
    }

    loginScreen.style.display = data.session ? "none" : "flex";
}

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    loginError.textContent = "შემოწმება...";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword.value
    });

    if (error) {
        loginError.textContent = "ელ. ფოსტა ან პაროლი არასწორია!";
        loginPassword.value = "";
        return;
    }

    loginPassword.value = "";
    loginError.textContent = "";
    loginScreen.style.display = "none";
});

logoutButton.addEventListener("click", async function () {
    if (!confirm("გსურთ გასვლა?")) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("გასვლისას შეცდომა მოხდა.");
        return;
    }

    location.reload();
});

// =====================================
// DATABASE
// =====================================

function migrateProducts(oldProducts) {
    const migrated = [];

    oldProducts.forEach(product => {
        if (product.date) {
            migrated.push({
                barcode: String(product.barcode),
                name: product.name,
                date: product.date
            });
            return;
        }

        if (Array.isArray(product.dates)) {
            product.dates.forEach(date => {
                migrated.push({
                    barcode: String(product.barcode),
                    name: product.name,
                    date: date
                });
            });
        }
    });

    return migrated.filter((product, index, array) => {
        return array.findIndex(item =>
            item.barcode === product.barcode &&
            item.date === product.date
        ) === index;
    });
}

let savedProducts = [];

try {
    savedProducts = JSON.parse(
        localStorage.getItem("scanora_products") || "[]"
    );

    if (!Array.isArray(savedProducts)) {
        savedProducts = [];
    }
} catch (error) {
    savedProducts = [];
}

let products = migrateProducts(savedProducts);

localStorage.setItem("scanora_products", JSON.stringify(products));

function saveDatabase() {
    localStorage.setItem("scanora_products", JSON.stringify(products));
    renderProducts();
}

// =====================================
// BARCODE SCANNER
// =====================================

let scanner = null;
let cameraControls = null;
let barcodeDetected = false;

scanButton.addEventListener("click", startCamera);

async function startCamera() {
    cameraModal.classList.add("show");
    cameraMessage.textContent = "შტრიხკოდის მოლოდინში...";
    barcodeDetected = false;

    try {
        scanner = new ZXingBrowser.BrowserMultiFormatReader();

        cameraControls = await scanner.decodeFromVideoDevice(
            undefined,
            video,
            (result, error) => {
                if (result && !barcodeDetected) {
                    barcodeDetected = true;

                    const barcode = result.getText();
                    cameraMessage.textContent = "შტრიხკოდის წაკითხვა: " + barcode;

                    stopCamera();
                    cameraModal.classList.remove("show");
                    searchProduct(barcode);
                }
            }
        );
    } catch (error) {
        cameraMessage.textContent =
            "კამერის გახსნა ვერ მოხერხდა. შტრიხკოდის შეყვანა შეგიძლიათ ხელით.";
        console.error(error);
    }
}

function stopCamera() {
    if (cameraControls) {
        cameraControls.stop();
        cameraControls = null;
    }

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

closeCamera.addEventListener("click", () => {
    stopCamera();
    cameraModal.classList.remove("show");
});

// =====================================
// MANUAL BARCODE
// =====================================

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
    const existingProduct = products.find(
        product => product.barcode === String(barcode)
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

    const existingProduct = products.find(
        product => product.barcode === barcode
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
// SAVE PRODUCT
// =====================================

productForm.addEventListener("submit", event => {
    event.preventDefault();

    const barcode = formBarcode.value.trim();
    const name = formName.value.trim();
    const date = formDate.value;

    if (!barcode || !name || !date) {
        alert("შეავსეთ ყველა უჯრა!");
        return;
    }

    const alreadyExists = products.some(product =>
        product.barcode === barcode &&
        product.date === date
    );

    if (alreadyExists) {
        alert("ამ პროდუქტის ბარათი ამ თარიღით ახლა ხელმისაწვდომია!");
        return;
    }

    products.push({ barcode, name, date });

    saveDatabase();

    productModal.classList.remove("show");
    productForm.reset();
    formName.readOnly = false;

    alert("პროდუქტი წარმატებით შენახულია!");
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

    const difference = Math.round((expiryUTC - todayUTC) / 86400000);

   if (difference <= 0) {
    return {
        className: "status-red",
        label: difference === 0 ?
            "დღეს მთავრდება: დრო ამოიწურა" :
            "ვადა გასულია"
    };
}
    if (difference <= 3) {
        return {
            className: "status-orange",
            label: `${difference} დარჩენილი დღეები`
        };
    }

    if (difference <= 7) {
        return {
            className: "status-yellow",
            label: `${difference} დარჩენილი დღეები `
        };
    }

    return {
        className: "status-green",
        label: "ნორმალური"
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
// CREATE PRODUCT CARD
// =====================================

function createProductCard(product) {
    const expiry = getExpiryInfo(product.date);
    const card = document.createElement("div");
    card.className = `product-card ${expiry.className}`;

    card.innerHTML = `
        <div class="product-card-top">
            <h3>${escapeHTML(product.name)}</h3>
            <span class="product-status">${expiry.label}</span>
        </div>

        <div class="product-barcode">
            <span>შტრიხკოდის ნომერი</span>
            <strong>${escapeHTML(product.barcode)}</strong>
        </div>

        <div class="product-expiry">
            <span>ვარგისიანობის ვადა</span>
            <strong>${formatDate(product.date)}</strong>
        </div>

        <button
            type="button"
            class="delete-product"
            data-barcode="${escapeHTML(product.barcode)}"
            data-date="${escapeHTML(product.date)}"
        >
            ამ ბარათის წაშლა
        </button>
    `;

    return card;
}

// =====================================
// SORT PRODUCTS
// =====================================

function sortProductItems(items) {
    const sorted = [...items];

    if (productSort.value === "nearest") {
        sorted.sort((a, b) => a.date.localeCompare(b.date));
    } else if (productSort.value === "farthest") {
        sorted.sort((a, b) => b.date.localeCompare(a.date));
    } else if (productSort.value === "az") {
        sorted.sort((a, b) => a.name.localeCompare(b.name, "az"));
    } else if (productSort.value === "za") {
        sorted.sort((a, b) => b.name.localeCompare(a.name, "az"));
    }

    return sorted;
}

// =====================================
// RENDER PRODUCTS
// =====================================

function renderProducts() {
    const searchText = productSearch.value.trim().toLowerCase();

    const searchedItems = products.filter(product => {
        const name = String(product.name || "").toLowerCase();
        const barcode = String(product.barcode || "").toLowerCase();
        return name.includes(searchText) || barcode.includes(searchText);
    });

    const expiredItems = searchedItems.filter(product =>
        getExpiryInfo(product.date).className === "status-red"
    );

    let filteredItems = searchedItems.filter(product => {
        const status = getExpiryInfo(product.date).className;

        if (activeFilter === "all") {
            return status !== "status-red";
        }

        return status === "status-" + activeFilter;
    });

    const sortedItems = sortProductItems(filteredItems);
    const sortedExpired = sortProductItems(expiredItems);

    productList.innerHTML = "";
    sortedItems.forEach(product => {
        productList.appendChild(createProductCard(product));
    });

    expiredProductList.innerHTML = "";
    sortedExpired.forEach(product => {
        expiredProductList.appendChild(createProductCard(product));
    });

    productCount.textContent = sortedItems.length + " პროდუქტი";
    expiredCount.textContent = expiredItems.length + " პროდუქტი";

    expiredSection.hidden =
        activeFilter !== "all" || expiredItems.length === 0;

    emptyProducts.hidden =
        sortedItems.length > 0 ||
        (activeFilter === "all" && expiredItems.length > 0);
}

// =====================================
// SEARCH
// =====================================

productSearch.addEventListener("input", () => renderProducts());

clearSearch.addEventListener("click", () => {
    productSearch.value = "";
    renderProducts();
});

// =====================================
// FILTER BUTTONS
// =====================================

filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        filterButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        activeFilter = button.dataset.filter;
        renderProducts();
    });
});

// =====================================
// SORT
// =====================================

productSort.addEventListener("change", () => renderProducts());

// =====================================
// DELETE ONE CARD
// =====================================

function deleteProduct(event) {
    const button = event.target.closest(".delete-product");
    if (!button) return;

    const barcode = button.dataset.barcode;
    const date = button.dataset.date;

    const approved = confirm("გსურთ ამ პროდუქტის ბარათის წაშლა?");
    if (!approved) return;

    products = products.filter(product => {
        return !(product.barcode === barcode && product.date === date);
    });

    saveDatabase();
}

productList.addEventListener("click", deleteProduct);
expiredProductList.addEventListener("click", deleteProduct);

// =====================================
// INITIALIZE
// =====================================

checkLogin();
renderProducts();
