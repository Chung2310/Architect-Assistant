const fs = require('fs');

let content = fs.readFileSync('src/components/Render.tsx', 'utf8');

// Pattern 1: processFiles (returns Promise)
content = content.replace(
  /const uploadTask = uploadBytesResumable\(storageRef, file\);\s*uploadTask\.on\('state_changed',\s*\(snapshot\) => {[\s\S]*?setUploadProgress\(progress\);\s*},\s*\(error\) => {[\s\S]*?reject\(error\);\s*},\s*async \(\) => {[\s\S]*?const downloadURL = await getDownloadURL\(uploadTask\.snapshot\.ref\);\s*cacheImage\(downloadURL, file\);\s*const reader = new FileReader\(\);\s*reader\.onloadend = \(\) => {[\s\S]*?resolve\(downloadURL\);\s*};\s*reader\.onerror = \(\) => resolve\(downloadURL\);\s*}\s*\);/g,
  `setUploadProgress(50);
          try {
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            cacheImage(downloadURL, file);
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result as string;
              setImageCache(prev => ({ ...prev, [downloadURL]: base64String.split(',')[1] }));
              setUploadProgress(100);
              resolve(downloadURL);
            };
            reader.onerror = () => resolve(downloadURL);
            reader.readAsDataURL(file);
          } catch (error) {
            console.error("Upload failed:", error);
            reject(error);
          }`
);

// Pattern 2: processFiles for reference image
content = content.replace(
  /const uploadTask = uploadBytesResumable\(storageRef, file\);\s*uploadTask\.on\('state_changed',\s*\(snapshot\) => {[\s\S]*?setUploadProgressRef\(progress\);\s*},\s*\(error\) => {[\s\S]*?reject\(error\);\s*},\s*async \(\) => {[\s\S]*?const downloadURL = await getDownloadURL\(uploadTask\.snapshot\.ref\);\s*cacheImage\(downloadURL, file\);\s*const reader = new FileReader\(\);\s*reader\.onloadend = \(\) => {[\s\S]*?resolve\(downloadURL\);\s*};\s*reader\.onerror = \(\) => resolve\(downloadURL\);\s*}\s*\);/g,
  `setUploadProgressRef(50);
          try {
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            cacheImage(downloadURL, file);
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result as string;
              setImageCache(prev => ({ ...prev, [downloadURL]: base64String.split(',')[1] }));
              setUploadProgressRef(100);
              resolve(downloadURL);
            };
            reader.onerror = () => resolve(downloadURL);
            reader.readAsDataURL(file);
          } catch (error) {
            console.error("Upload failed:", error);
            reject(error);
          }`
);

// Pattern 3: handleImageUpload (multiple files)
content = content.replace(
  /const uploadTask = uploadBytesResumable\(storageRef, file\);\s*await new Promise<void>\(\(resolve, reject\) => {\s*uploadTask\.on\('state_changed',\s*\(snapshot\) => {[\s\S]*?setUploadProgress\(progress\);\s*},\s*\(error\) => {[\s\S]*?reject\(error\);\s*},\s*async \(\) => {[\s\S]*?const downloadURL = await getDownloadURL\(uploadTask\.snapshot\.ref\);\s*cacheImage\(downloadURL, file\);\s*newImageUrls\.push\(downloadURL\);\s*resolve\(\);\s*}\s*\);\s*}\);/g,
  `setUploadProgress(50);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        cacheImage(downloadURL, file);
        newImageUrls.push(downloadURL);
        setUploadProgress(100);`
);

// Pattern 4: standard handleImageUpload
content = content.replace(
  /const uploadTask = uploadBytesResumable\(storageRef, file\);\s*uploadTask\.on\('state_changed',\s*\(snapshot\) => {[\s\S]*?setUploadProgress\(progress\);\s*},\s*\(error\) => {[\s\S]*?setIsUploading\(false\);\s*(?:toast\.error\('Lỗi khi tải ảnh lên\. Vui lòng thử lại\.'\);\s*)?},\s*async \(\) => {[\s\S]*?const downloadURL = await getDownloadURL\(uploadTask\.snapshot\.ref\);\s*cacheImage\(downloadURL, file\);\s*setInputImage\(downloadURL\);\s*setIsUploading\(false\);\s*}\s*\);/g,
  `setUploadProgress(50);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      cacheImage(downloadURL, file);
      setInputImage(downloadURL);
      setUploadProgress(100);
      setIsUploading(false);`
);

// Pattern 5: standard handleImageUpload with setUploadProgressRef
content = content.replace(
  /const uploadTask = uploadBytesResumable\(storageRef, file\);\s*uploadTask\.on\('state_changed',\s*\(snapshot\) => {[\s\S]*?setUploadProgressRef\(progress\);\s*},\s*\(error\) => {[\s\S]*?setIsUploadingRef\(false\);\s*(?:toast\.error\('Lỗi khi tải ảnh lên\. Vui lòng thử lại\.'\);\s*)?},\s*async \(\) => {[\s\S]*?const downloadURL = await getDownloadURL\(uploadTask\.snapshot\.ref\);\s*cacheImage\(downloadURL, file\);\s*setReferenceImage\(downloadURL\);\s*setIsUploadingRef\(false\);\s*}\s*\);/g,
  `setUploadProgressRef(50);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      cacheImage(downloadURL, file);
      setReferenceImage(downloadURL);
      setUploadProgressRef(100);
      setIsUploadingRef(false);`
);

// Pattern 6: character upload
content = content.replace(
  /const uploadTask = uploadBytesResumable\(storageRef, file\);\s*await new Promise<void>\(\(resolve, reject\) => {\s*uploadTask\.on\('state_changed', null, reject, \(\) => resolve\(\)\);\s*}\);\s*const downloadURL = await getDownloadURL\(storageRef\);/g,
  `await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);`
);

// Pattern 7: blob upload
content = content.replace(
  /const uploadTask = uploadBytesResumable\(storageRef, blob\);\s*await new Promise<void>\(\(resolve, reject\) => {\s*uploadTask\.on\('state_changed',\s*\(snapshot\) => {[\s\S]*?updateStatus\(Math\.round\(50 \+ \(progress \/ 2\)\), 'Đang lưu trữ kết quả\.\.\.'\);\s*},\s*\(error\) => {\s*reject\(error\);\s*},\s*\(\) => {\s*resolve\(\);\s*}\s*\);\s*}\);\s*generatedImageUrl = await getDownloadURL\(storageRef\);/g,
  `await uploadBytes(storageRef, blob);
          generatedImageUrl = await getDownloadURL(storageRef);`
);

fs.writeFileSync('src/components/Render.tsx', content);
console.log('Replacements done.');
