<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rolo AI Trading Assistant</title>
    <!-- Tailwind CSS CDN - Added back for direct use -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Inter Font -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        /* Custom Scrollbar Style for the entire page */
        body::-webkit-scrollbar {
            width: 8px;
        }
        body::-webkit-scrollbar-track {
            background: #1f2937; /* bg-gray-800 */
            border-radius: 10px;
        }
        body::-webkit-scrollbar-thumb {
            background: #8b5cf6; /* bg-purple-500 */
            border-radius: 10px;
        }
        body::-webkit-scrollbar-thumb:hover {
            background: #a78bfa; /* lighter purple */
        }
        /* Ensure body takes full height */
        html, body, #root {
            height: 100%;
            margin: 0;
            overflow: hidden; /* Prevent double scrollbars, let React component manage scroll */
        }
        .font-inter {
            font-family: 'Inter', sans-serif;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-gray-900 to-black text-gray-100 font-inter">
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <!-- The main entry point for your React application -->
    <script type="module" src="/src/main.jsx"></script>
</body>
</html>
