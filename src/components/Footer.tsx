import { motion } from "framer-motion";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="bg-green-900 text-white py-6 mt-auto"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-4">
            <img
              src={logo}
              alt="ATTS Logo"
              className="w-20 sm:w-24 object-contain drop-shadow-md"
            />
            <p className="text-xs sm:text-sm text-center sm:text-left">
              &copy; {new Date().getFullYear()} All Terrain Tree Service. All rights reserved.
            </p>
          </div>

          <div className="flex-1 max-w-2xl">
            <p className="text-sm sm:text-base text-center sm:text-right leading-relaxed">
              At ATTS (All Terrain Tree Service), we're committed to safety, excellence, and teamwork.
              Our mission is to deliver professional tree service solutions while maintaining a culture of integrity, care, and continuous improvement.
            </p>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
