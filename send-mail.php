<?php
require __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

// --- basic validation ---
$errors = [];
$required = ['Firstname', 'Lastname', 'Email'];
foreach ($required as $field) {
    if (empty($_POST[$field])) {
        $errors[$field] = "$field is required";
    }
}
if (!empty($_POST['Email']) && !filter_var($_POST['Email'], FILTER_VALIDATE_EMAIL)) {
    $errors['Email'] = 'Invalid email address';
}
if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'errors' => $errors]);
    exit;
}

$firstname = trim($_POST['Firstname']);
$lastname  = trim($_POST['Lastname']);
$email     = trim($_POST['Email']);
$phone     = trim($_POST['Phone'] ?? '');
$company   = trim($_POST['Company'] ?? '');
$message   = trim($_POST['Message'] ?? '');

$mail = new PHPMailer(true);

try {
    // --- SMTP / Gmail app password config ---
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'fathimatmuhsina@gmail.com';
    $mail->Password   = 'xohcpqbvfbbhxbpk';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    $mail->setFrom('fathimatmuhsina@gmail.com', 'Aythronix Website');
    $mail->addAddress('fathimatmuhsina@gmail.com');
    $mail->addReplyTo($email, "$firstname $lastname");

    $mail->isHTML(false);
    $mail->Subject = "New consultation request from $firstname $lastname";
    $mail->Body    = "Firstname: $firstname\nLastname: $lastname\nEmail: $email\nPhone: $phone\nCompany: $company\nMessage: $message";

    $mail->send();
    echo json_encode(['status' => 'ok']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Mail could not be sent']);
}