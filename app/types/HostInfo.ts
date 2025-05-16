// Roughly follows the HostInfo we get from the headplane agent
// Should it drift too much we may begin to get errors, but in go its stable
// https://github.com/tailscale/tailscale/blob/main/tailcfg/tailcfg.go#L816

export interface HostInfo {
	/**
	 * Custom identifier we use to determine if its an agent or not
	 */
	HeadplaneAgent?: boolean;

	/** Version of this code (in version.Long format) */
	IPNVersion?: string;

	/** Logtail ID of frontend instance */
	FrontendLogID?: string;

	/** Logtail ID of backend instance */
	BackendLogID?: string;

	/** Operating system the client runs on (a version.OS value) */
	OS?: string;

	/**
	 * Version of the OS, if available.
	 *
	 * - Android: "10", "11", "12", etc.
	 * - iOS/macOS: "15.6.1", "12.4.0", etc.
	 * - Windows: "10.0.19044.1889", etc.
	 * - FreeBSD: "12.3-STABLE", etc.
	 * - Linux (pre-1.32): "Debian 10.4; kernel=xxx; container; env=kn"
	 * - Linux (1.32+): Kernel version, e.g., "5.10.0-17-amd64".
	 */
	OSVersion?: string;

	/** Whether the client is running in a container (best-effort detection) */
	Container?: boolean;

	/** Host environment type as a string */
	Env?: string;

	/** Distribution name (e.g., "debian", "ubuntu", "nixos") */
	Distro?: string;

	/** Distribution version (e.g., "20.04") */
	DistroVersion?: string;

	/** Distribution code name (e.g., "jammy", "bullseye") */
	DistroCodeName?: string;

	/** Used to disambiguate Tailscale clients that run using tsnet */
	App?: string;

	/** Whether a desktop was detected on Linux */
	Desktop?: boolean;

	/** Tailscale package identifier ("choco", "appstore", etc.; empty if unknown) */
	Package?: string;

	/** Mobile phone model (e.g., "Pixel 3a", "iPhone12,3") */
	DeviceModel?: string;

	/** macOS/iOS APNs device token for notifications (future support for Android) */
	PushDeviceToken?: string;

	/** Name of the host the client runs on */
	Hostname?: string;

	/** Indicates whether the host is blocking incoming connections */
	ShieldsUp?: boolean;

	/** Indicates this node exists in netmap because it's owned by a shared-to user */
	ShareeNode?: boolean;

	/** Indicates user has opted out of sending logs and support */
	NoLogsNoSupport?: boolean;

	/** Indicates the node wants the option to receive ingress connections */
	WireIngress?: boolean;

	/** Indicates node has opted-in to admin-console-driven remote updates */
	AllowsUpdate?: boolean;

	/** Current host's machine type (e.g., uname -m) */
	Machine?: string;

	/** `GOARCH` value of the built binary */
	GoArch?: string;

	/** Architecture variant (e.g., GOARM, GOAMD64) of the built binary */
	GoArchVar?: string;

	/** Go version the binary was built with */
	GoVersion?: string;

	/** Set of IP ranges this client can route */
	RoutableIPs?: string[];

	/** Set of ACL tags this node wants to claim */
	RequestTags?: string[];

	/** MAC addresses to send Wake-on-LAN packets to wake this node */
	WoLMACs?: string[];

	/** Services advertised by this machine */
	Services?: Service[];

	/** Networking information about the node */
	NetInfo?: NetInfo;

	/** SSH host keys if advertised */
	sshHostKeys?: string[];

	/** Cloud provider information (if any) */
	Cloud?: string;

	/** Indicates if the client is running in userspace (netstack) mode */
	Userspace?: boolean;

	/** Indicates if the client's subnet router is running in userspace (netstack) mode */
	UserspaceRouter?: boolean;

	/** Indicates if the client is running the app-connector service */
	AppConnector?: boolean;

	/** Opaque hash of the most recent list of tailnet services (indicates config updates) */
	ServicesHash?: string;

	/** Geographical location data about the Tailscale host (optional) */
	Location?: Location;
}

/** Represents a network service advertised by a node */
interface Service {
	/** Protocol type (e.g., "tcp", "udp", "peerapi4") */
	Proto: string;

	/** Port number */
	Port: number;

	/** Textual description of the service (usually the process name) */
	Description?: string;
}

/** Networking information for a Tailscale node */
interface NetInfo {
	/** Indicates if NAT mappings vary based on destination IP */
	MappingVariesByDestIP?: boolean;

	/** Indicates if the router supports hairpinning */
	HairPinning?: boolean;

	/** Indicates if the host has IPv6 internet connectivity */
	WorkingIPv6?: boolean;

	/** Indicates if the OS supports IPv6 */
	OSHasIPv6?: boolean;

	/** Indicates if the host has UDP internet connectivity */
	WorkingUDP?: boolean;

	/** Indicates if ICMPv4 works (empty if not checked) */
	WorkingICMPv4?: boolean;

	/** Indicates if there is an existing portmap open (UPnP, PMP, PCP) */
	HavePortMap?: boolean;

	/** Indicates if UPnP appears present on the LAN (empty if not checked) */
	UPnP?: boolean;

	/** Indicates if NAT-PMP appears present on the LAN (empty if not checked) */
	PMP?: boolean;

	/** Indicates if PCP appears present on the LAN (empty if not checked) */
	PCP?: boolean;

	/** Preferred DERP region ID */
	PreferredDERP?: number;

	/** Current link type ("wired", "wifi", "mobile") */
	LinkType?: string;

	/** Fastest recent time to reach various DERP STUN servers (seconds) */
	DERPLatency?: Record<string, number>;

	/** Firewall mode on Linux-specific configurations */
	FirewallMode?: string;
}

/** Represents the geographical location of a Tailscale host */
interface Location {
	/** Country name (user-friendly, properly capitalized) */
	Country?: string;

	/** ISO 3166-1 alpha-2 country code (upper case) */
	CountryCode?: string;

	/** City name (user-friendly, properly capitalized) */
	City?: string;

	/** City code to disambiguate between cities (e.g., IATA, ICAO, ISO 3166-2) */
	CityCode?: string;

	/** Latitude of the node (in degrees, optional) */
	Latitude?: number;

	/** Longitude of the node (in degrees, optional) */
	Longitude?: number;

	/** Priority for exit node selection (0 means no priority, negative not allowed) */
	Priority?: number;
}
