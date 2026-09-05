const SUPABASE_URL = "https://jflavxpfytmtkjkbielw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0QAerSSi6B9jOUufph_IOg_bcjQTEpJ";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getCurrentPaymentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
}

window.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    document.getElementById('exportAttendanceBtn').addEventListener('click', exportTodayAttendance);
    document.getElementById('exportPaymentsBtn').addEventListener('click', exportMonthlyPayments);
});

async function loadDashboardStats() {
    try {
        const { count: studentsCount } = await db.from('students').select('*', { count: 'exact', head: true });
        document.getElementById('totalStudentsCount').textContent = studentsCount || 0;

        const { count: attendanceCount } = await db.from('attendance').select('*', { count: 'exact', head: true });
        document.getElementById('todayAttendanceCount').textContent = attendanceCount || 0;

        const { count: paymentsCount } = await db.from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('payment_month', getCurrentPaymentMonth())
            .eq('status', 'مدفوع');
        document.getElementById('paidStudentsCount').textContent = paymentsCount || 0;

    } catch (err) {
        console.error('خطأ في تحضير الإحصائيات:', err);
    }
}

async function exportTodayAttendance() {
    try {
        const { data, error } = await db.from('attendance').select('created_at, payment_status, students(student_id, student_name, student_group)');
        if (error) throw error;

        const excelData = data.map(item => ({
            "كود الطالب": item.students?.student_id || '-',
            "الاسم": item.students?.student_name || '-',
            "المجموعة": item.students?.student_group || '-',
            "حالة الدفع": item.payment_status,
            "وقت الحضور": new Date(item.created_at).toLocaleTimeString('ar-EG')
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "حضور اليوم");
        XLSX.writeFile(workbook, `حضور_اليوم_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        alert('حدث خطأ أثناء تصدير الحضور: ' + err.message);
    }
}

async function exportMonthlyPayments() {
    try {
        const { data, error } = await db.from('payments')
            .select('payment_month, status, paid_at, students(student_id, student_name, student_group)')
            .eq('payment_month', getCurrentPaymentMonth());
        if (error) throw error;

        const excelData = data.map(item => ({
            "كود الطالب": item.students?.student_id || '-',
            "الاسم": item.students?.student_name || '-',
            "المجموعة": item.students?.student_group || '-',
            "حالة الدفع": item.status,
            "تاريخ التسديد": item.paid_at ? new Date(item.paid_at).toLocaleDateString('ar-EG') : '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "المدفوعات");
        XLSX.writeFile(workbook, `مدفوعات_الشهر_${getCurrentPaymentMonth()}.xlsx`);
    } catch (err) {
        alert('حدث خطأ أثناء تصدير المدفوعات: ' + err.message);
    }
}