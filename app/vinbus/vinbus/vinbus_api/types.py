from typing import TypedDict, List, Optional, Literal

class Region(TypedDict):
    id: int
    code: str
    countryId: Optional[int]
    title: str
    titleEn: str
    description: str
    descriptionEn: str
    imageUrl: str
    region: str
    centralPoint: str
    allowBuyTicket: bool

class NearStation(TypedDict):
    id: int
    stationId: int
    regionId: int
    stationName: str
    stationAddress: str
    lat: float
    lng: float
    voice1url: Optional[str]
    stationCode: Optional[str]
    stationType: Optional[int]
    isInternalStation: bool
    screenHeader: Optional[str]
    lastUpdateTime: Optional[str]
    hasBoardLed: Optional[bool]
    referCityStationId: Optional[int]
    stationNameEn: Optional[str]
    stationAddressEn: Optional[str]
    createdAt: str
    updatedAt: str
    arrRouteNo: List[str]
    distanceToUser: float

class RouteAlert(TypedDict):
    id: int
    routeAlertBusmapId: Optional[int]
    enable: bool
    startDate: str
    endDate: str
    title: str
    titleEn: str
    description: str
    descriptionEn: str
    url: str
    titleVinid: str
    titleVinidEn: str
    busRegionId: int
    enableHideTimeline: Optional[bool]
    createdAt: str
    updatedAt: str

class RouteInfo(TypedDict):
    id: int
    routeName: str
    routeNo: str
    routeId: int
    regionId: int
    privateRoute: Optional[bool]
    disabled: Optional[bool]
    totalScore: int
    operationTime: str
    normalTicket: str
    isInternalRoute: bool
    temporaryClosed: Optional[bool]
    underConstruction: Optional[bool]
    headway: str
    routeAlerts: List[RouteAlert]
    routeType: int
    isFavorite: bool

class RouteDetail(TypedDict):
    routeId: int
    routeNo: str
    routeName: str
    polylineOutward: str
    polylineInward: str
    stationsOutward: List[NearStation]
    stationsInward: List[NearStation]

class RealTimeVehicle(TypedDict):
    busId: str
    plateNumber: str
    lat: float
    lng: float
    speed: float
    bearing: float
    routeId: int
    isOutward: bool
    lastUpdate: str

class BusEtaInfo(TypedDict):
    busId: str
    routeId: int
    stationId: int
    plateNumber: str
    etaMinutes: int
    etaDistance: int
    status: Literal["approaching", "arrived", "delayed"]

class TransitDetail(TypedDict):
    routeId: int
    routeNo: str
    routeName: str
    departureStation: NearStation
    arrivalStation: NearStation
    numStops: int

class DirectionStep(TypedDict):
    stepType: Literal["walk", "transit"]
    distance: float
    duration: float
    polyline: str
    transitDetail: Optional[TransitDetail]

class DirectionRoute(TypedDict):
    totalTime: float
    totalDistance: float
    totalWalkDistance: float
    steps: List[DirectionStep]

class DirectionResponse(TypedDict):
    routes: List[DirectionRoute]
