import DashboardLayout from "../layouts/DashboardLayout";

export default function Contact() {
  return (
    <DashboardLayout title="Contact Management & HR">
          <div className="bg-white/10 backdrop-blur-md shadow-xl rounded-2xl p-6 sm:p-7 md:p-10 w-full max-w-sm sm:max-w-md md:max-w-lg text-center border border-white/20">
            <p className="text-base sm:text-lg text-gray-300 mb-8 sm:mb-10 leading-relaxed px-2">
              For internal questions, requests, or reporting issues, please reach
              out to the appropriate department below.
            </p>

            <div className="space-y-5 sm:space-y-6 text-left">
              <div className="bg-gray-800/50 p-5 sm:p-6 md:p-7 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-white/10">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-green-400 mb-2">
                  General Management
                </h2>
                <p className="text-sm sm:text-base text-gray-400 mb-4">Contact: Steve Curtis</p>
                <div className="space-y-3">
                  <p className="text-base sm:text-lg flex items-start gap-3">
                    <span className="flex-shrink-0 text-xl">📞</span>
                    <span className="font-medium text-gray-300">Phone:</span>
                    <a
                      href="tel:8702809951"
                      className="text-green-400 hover:text-green-300 hover:underline active:text-green-500 touch-manipulation min-h-[44px] flex items-center"
                    >
                      (870) 280-9951
                    </a>
                  </p>
                  <p className="text-base sm:text-lg flex items-start gap-3">
                    <span className="flex-shrink-0 text-xl">📧</span>
                    <span className="font-medium text-gray-300">Email:</span>
                    <a
                      href="mailto:Steve@alltts.com"
                      className="text-green-400 hover:text-green-300 hover:underline active:text-green-500 break-all touch-manipulation min-h-[44px] flex items-center"
                    >
                      Steve@alltts.com
                    </a>
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/50 p-5 sm:p-6 md:p-7 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-white/10">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-green-400 mb-2">
                  Human Resources
                </h2>
                <p className="text-sm sm:text-base text-gray-400 mb-4">Contact: Shane Flud</p>
                <div className="space-y-3">
                  <p className="text-base sm:text-lg flex items-start gap-3">
                    <span className="flex-shrink-0 text-xl">📞</span>
                    <span className="font-medium text-gray-300">Phone:</span>
                    <a
                      href="tel:8706880398"
                      className="text-green-400 hover:text-green-300 hover:underline active:text-green-500 touch-manipulation min-h-[44px] flex items-center"
                    >
                      (870) 688-0398
                    </a>
                  </p>
                  <p className="text-base sm:text-lg flex items-start gap-3">
                    <span className="flex-shrink-0 text-xl">📧</span>
                    <span className="font-medium text-gray-300">Email:</span>
                    <a
                      href="mailto:Shane@alltts.com"
                      className="text-green-400 hover:text-green-300 hover:underline active:text-green-500 break-all touch-manipulation min-h-[44px] flex items-center"
                    >
                      Shane@alltts.com
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/20 pt-5 mt-6 sm:mt-8 text-center text-sm sm:text-base text-gray-400">
              <p>© {new Date().getFullYear()} All Terrain Tree Service (ATTS)</p>
            </div>
          </div>
    </DashboardLayout>
  );
}
