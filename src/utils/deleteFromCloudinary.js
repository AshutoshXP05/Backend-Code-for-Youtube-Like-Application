import { v2 as cloudinary } from "cloudinary";

const getPublicIdFromUrl = (url) => {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const publicId = filename.split('.')[0]; // remove extension
    const folder = parts[parts.length - 2]; // usually your Cloudinary folder
    return `${folder}/${publicId}`; // e.g. "avatars/abc123"
}

const deleteFromCloudinary = async (url) => {
    if (!url) return;

    const publicId = getPublicIdFromUrl(url);

    try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted from Cloudinary: ${publicId}`);
    } catch (err) {
        console.error("Cloudinary deletion error:", err.message);
    }
}

export { deleteFromCloudinary }
