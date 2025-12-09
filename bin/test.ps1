# save-as: D:\Projects\Make_Your_Life_Easier.A.E\create-cert.ps1

# Δημιούργησε self-signed certificate με PowerShell
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=ThomasThanos" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(1)

# Εξαγωγή ως PFX
$password = ConvertTo-SecureString -String "12123123" -Force -AsPlainText

# Αποθήκευση στο bin φάκελο
$outputPath = "D:\Projects\Make_Your_Life_Easier.A.E\bin\certificate.pfx"
Export-PfxCertificate -Cert $cert -FilePath $outputPath -Password $password

# Εξαγωγή public key για electron-builder
Export-Certificate -Cert $cert -FilePath "D:\Projects\Make_Your_Life_Easier.A.E\bin\certificate.cer"

# Εμφάνιση πληροφοριών
Write-Host "✅ Certificate created successfully!" -ForegroundColor Green
Write-Host "📁 PFX Location: D:\Projects\Make_Your_Life_Easier.A.E\bin\certificate.pfx"
Write-Host "📁 CER Location: D:\Projects\Make_Your_Life_Easier.A.E\bin\certificate.cer"
Write-Host "🔐 Password: 12123123"
Write-Host "🔑 Thumbprint: $($cert.Thumbprint)"