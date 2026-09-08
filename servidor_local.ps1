param(
    [int]$Port = 8080
)

$basePath = "G:\IA\FINA MASSA"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
    $listener.Start()
    Write-Host "Servidor ativo em http://localhost:$Port/ e http://127.0.0.1:$Port/"
} catch {
    Write-Host "Falha ao iniciar servidor: $($_.Exception.Message)"
    exit 1
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".webp" = "image/webp"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Add CORS headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")

        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($localPath) -or $localPath.EndsWith('/')) {
            $localPath += "index.html"
        }

        if ($request.HttpMethod -eq "POST" -and $localPath -eq "save_test_results") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $postData = $reader.ReadToEnd()
            [System.IO.File]::WriteAllText((Join-Path $basePath "test_results.json"), $postData, [System.Text.Encoding]::UTF8)
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
            $response.ContentType = "application/json"
            $response.StatusCode = 200
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo nao encontrado")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    } catch {
        # Continue loop on client disconnect
    }
}