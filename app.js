// ==========================================
 // BLOCKCHAIN STUDENT ATTENDANCE SYSTEM
 // CLEAN VERSION - OLD STUDENTS HIDDEN
 // NO MIGRATION FUNCTION
 // ==========================================

const CONTRACT_ADDRESS =
    "0x2425DB30f4104D462eeFa8569D146b45d92c481B";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

// Remembers where new registrations begin
const STORAGE_KEY = "attendance_new_student_start_v1";

const ABI = [
    "function studentCount() view returns (uint256)",
    "function addStudent(string,uint256)",
    "function markAttendance(uint256)",
    "function markAbsent(uint256)",
    "function getStudent(uint256) view returns (uint256,string,uint256,bool)",
    "function getAttendanceHistory(uint256) view returns (uint256[],bool[])",
    "function getAttendancePercentage(uint256) view returns (uint256,uint256,uint256)",
    "function attendanceMarked(uint256,uint256) view returns (bool)",
    "function attendance(uint256,uint256) view returns (bool)"
];

let provider;
let signer;
let contract;
let students = [];
let firstNewStudentId = null;
let busy = false;

const $ = id => document.getElementById(id);

// ==========================================
// STATUS
// ==========================================

function setStatus(message, error = false) {
    $("status").textContent = message;
    $("status").style.background =
        error ? "#fee2e2" : "#e0f2fe";
    $("status").style.color =
        error ? "#b91c1c" : "#075985";
}

function errorMessage(error) {
    return error?.shortMessage ||
        error?.reason ||
        error?.info?.error?.message ||
        error?.message ||
        "Unknown error";
}

function requireContract() {
    if (!contract) {
        throw new Error("Connect MetaMask first.");
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

function validPositiveInteger(value) {
    return /^\d+$/.test(value) && BigInt(value) > 0n;
}

// ==========================================
// CONNECT METAMASK
// ==========================================

async function connectWallet() {
    try {
        if (!window.ethereum) {
            throw new Error("Install MetaMask first.");
        }

        let chainId = await window.ethereum.request({
            method: "eth_chainId"
        });

        if (chainId !== SEPOLIA_CHAIN_ID) {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: SEPOLIA_CHAIN_ID }]
            });
        }

        provider = new ethers.BrowserProvider(window.ethereum);

        await provider.send("eth_requestAccounts", []);

        signer = await provider.getSigner();

        const address = await signer.getAddress();

        contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            ABI,
            signer
        );

        // Save the existing student count as the starting point.
        // Existing students will be hidden from this website.
        let savedStart = localStorage.getItem(STORAGE_KEY);

        if (savedStart === null) {
            const oldCount = await contract.studentCount();

            firstNewStudentId = Number(oldCount) + 1;

            localStorage.setItem(
                STORAGE_KEY,
                String(firstNewStudentId)
            );
        } else {
            firstNewStudentId = Number(savedStart);
        }

        $("walletAddress").textContent =
            "Connected Wallet: " + address;

        setStatus("Connected successfully. Ready for new registrations.");

        await updateDashboard();

    } catch (error) {
        console.error(error);
        setStatus(errorMessage(error), true);
    }
}

// ==========================================
// LOAD ONLY NEW STUDENTS
// ==========================================

async function updateDashboard() {
    try {
        requireContract();

        const count = Number(await contract.studentCount());

        students = [];

        for (
            let i = firstNewStudentId;
            i <= count;
            i++
        ) {
            const s = await contract.getStudent(i);

            students.push({
                id: s[0].toString(),
                name: s[1],
                registerNumber: s[2].toString(),
                isPresent: s[3]
            });
        }

        displayAttendanceTable();

        setStatus(
            students.length +
            " newly registered students loaded."
        );

    } catch (error) {
        console.error(error);
        setStatus(
            "Unable to load students: " + errorMessage(error),
            true
        );
    }
}

// ==========================================
// DISPLAY ATTENDANCE TABLE
// ==========================================

function displayAttendanceTable() {
    const tbody = $("attendanceTableBody");

    tbody.innerHTML = "";

    if (students.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="4">No new students registered. Please add students.</td></tr>';
        return;
    }

    students.forEach((student, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>

            <td>${escapeHTML(student.name)}</td>

            <td>
                <input type="radio"
                    name="attendance_${student.id}"
                    value="true">
            </td>

            <td>
                <input type="radio"
                    name="attendance_${student.id}"
                    value="false">
            </td>
        `;

        tbody.appendChild(row);
    });
}

// ==========================================
// REGISTER NEW STUDENT
// ==========================================

async function addStudent() {
    try {
        requireContract();

        if (busy) {
            throw new Error("Please wait for the current transaction.");
        }

        const name = $("studentName").value.trim();

        const registerNumber =
            $("registerNumber").value.trim();

        if (!name || !validPositiveInteger(registerNumber)) {
            throw new Error(
                "Enter a valid student name and register number."
            );
        }

        busy = true;
        $("addStudentButton").disabled = true;

        setStatus("Confirm student registration in MetaMask.");

        const tx = await contract.addStudent(
            name,
            BigInt(registerNumber)
        );

        setStatus("Waiting for transaction confirmation...");

        await tx.wait();

        $("studentName").value = "";
        $("registerNumber").value = "";

        await updateDashboard();

        setStatus(name + " registered successfully.");

    } catch (error) {
        console.error(error);
        setStatus(
            "Registration failed: " + errorMessage(error),
            true
        );

    } finally {
        busy = false;
        $("addStudentButton").disabled = false;
    }
}

// ==========================================
// SUBMIT ATTENDANCE
// Uses original contract functions
// ==========================================

async function submitAttendance() {
    const button = $("submitAttendanceButton");

    try {
        requireContract();

        if (busy) {
            throw new Error("Another transaction is in progress.");
        }

        if (students.length === 0) {
            throw new Error("No new students registered.");
        }

        const attendanceList = [];

        for (const student of students) {
            const selected = document.querySelector(
                `input[name="attendance_${student.id}"]:checked`
            );

            if (!selected) {
                throw new Error(
                    "Select Present or Absent for " + student.name
                );
            }

            attendanceList.push({
                id: student.id,
                name: student.name,
                present: selected.value === "true"
            });
        }

        if (!window.confirm(
            "Submit attendance for " +
            attendanceList.length +
            " students? Each student requires a separate transaction."
        )) {
            return;
        }

        busy = true;
        button.disabled = true;

        for (let i = 0; i < attendanceList.length; i++) {
            const item = attendanceList[i];

            setStatus(
                "Submitting attendance for " +
                item.name + " (" + (i + 1) +
                "/" + attendanceList.length + ")"
            );

            const tx = item.present
                ? await contract.markAttendance(BigInt(item.id))
                : await contract.markAbsent(BigInt(item.id));

            await tx.wait();
        }

        document.querySelectorAll(
            '#attendanceTableBody input[type="radio"]'
        ).forEach(input => input.checked = false);

        await updateDashboard();

        setStatus("All student attendance records saved successfully.");

    } catch (error) {
        console.error(error);
        setStatus(
            "Attendance failed: " + errorMessage(error),
            true
        );

    } finally {
        busy = false;
        button.disabled = false;
    }
}

// ==========================================
// VIEW STUDENT DETAILS
// ==========================================

async function viewStudent() {
    try {
        requireContract();

        const id = $("viewStudentId").value;

        if (!validPositiveInteger(id)) {
            throw new Error("Enter a valid Student ID.");
        }

        const studentId = BigInt(id);

        if (Number(studentId) < firstNewStudentId) {
            throw new Error("This is an old student record.");
        }

        const s = await contract.getStudent(studentId);

        $("studentDetails").innerHTML = `
            <p><b>Student ID:</b> ${s[0]}</p>
            <p><b>Name:</b> ${escapeHTML(s[1])}</p>
            <p><b>Register Number:</b> ${s[2]}</p>
            <p><b>Current Status:</b>
                ${s[3] ? "Present" : "Absent"}
            </p>
        `;

    } catch (error) {
        $("studentDetails").textContent = errorMessage(error);
    }
}

// ==========================================
// VIEW ATTENDANCE HISTORY
// ==========================================

async function viewAttendanceHistory() {
    try {
        requireContract();

        const id = $("historyStudentId").value;

        if (!validPositiveInteger(id)) {
            throw new Error("Enter a valid Student ID.");
        }

        const studentId = BigInt(id);

        if (Number(studentId) < firstNewStudentId) {
            throw new Error("This is an old student record.");
        }

        const s = await contract.getStudent(studentId);

        const history =
            await contract.getAttendanceHistory(studentId);

        const percentage =
            await contract.getAttendancePercentage(studentId);

        let html = `
            <h3>History of ${escapeHTML(s[1])}</h3>

            <div class="table-container">
            <table>
                <thead>
                    <tr><th>Date</th><th>Status</th></tr>
                </thead>
                <tbody>
        `;

        for (let i = 0; i < history[0].length; i++) {
            const date = new Date(
                Number(history[0][i]) * 86400000
            );

            html += `
                <tr>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${history[1][i] ? "Present" : "Absent"}</td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
            </div>

            <p>Total classes: ${percentage[0]}</p>
            <p>Present classes: ${percentage[1]}</p>
            <p>Attendance percentage: ${percentage[2]}%</p>
        `;

        $("attendanceHistory").innerHTML = html;

    } catch (error) {
        $("attendanceHistory").textContent =
            errorMessage(error);
    }
}

// ==========================================
// VIEW CLASS ATTENDANCE BY DATE
// ==========================================

async function viewClassAttendance() {
    try {
        requireContract();

        const value = $("classAttendanceDate").value;

        if (!value) {
            throw new Error("Select a date.");
        }

        const [year, month, day] =
            value.split("-").map(Number);

        const dateNumber = BigInt(
            Math.floor(
                Date.UTC(year, month - 1, day) / 86400000
            )
        );

        let html = `
            <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Register Number</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const student of students) {
            const marked = await contract.attendanceMarked(
                dateNumber,
                BigInt(student.id)
            );

            let status = "Not Marked";

            if (marked) {
                const present = await contract.attendance(
                    BigInt(student.id),
                    dateNumber
                );

                status = present ? "Present" : "Absent";
            }

            html += `
                <tr>
                    <td>${student.id}</td>
                    <td>${escapeHTML(student.name)}</td>
                    <td>${student.registerNumber}</td>
                    <td>${status}</td>
                </tr>
            `;
        }

        html += "</tbody></table></div>";

        $("classAttendance").innerHTML = html;

    } catch (error) {
        $("classAttendance").textContent =
            errorMessage(error);
    }
}

// ==========================================
// BUTTON EVENTS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    $("connectButton").addEventListener(
        "click",
        connectWallet
    );

    $("addStudentButton").addEventListener(
        "click",
        addStudent
    );

    $("submitAttendanceButton").addEventListener(
        "click",
        submitAttendance
    );

    $("viewStudentButton").addEventListener(
        "click",
        viewStudent
    );

    $("historyButton").addEventListener(
        "click",
        viewAttendanceHistory
    );

    $("classAttendanceButton").addEventListener(
        "click",
        viewClassAttendance
    );

    if (window.ethereum) {
        window.ethereum.on("accountsChanged", () => {
            contract = null;
            signer = null;
            students = [];

            $("walletAddress").textContent =
                "Wallet changed. Reconnect MetaMask.";

            $("attendanceTableBody").innerHTML =
                '<tr><td colspan="4">Please reconnect MetaMask.</td></tr>';

            setStatus("Wallet changed. Please reconnect.");
        });

        window.ethereum.on("chainChanged", () => {
            window.location.reload();
        });
    }
});