# value-limit
Checks if given `msg`\'s property is in limits. If an error message is set, node
will throw error if value is not in set limits. Limits are loaded from `limits.csv`
file located in Node-RED's config directory (default `~/.node-red`).

Example `limits.csv` file:
> ;Name,Field,Min,Max,Throw  
> 24VB SNS soft,24VB_SNS_soft,18000,23000,24VB_SNS_SOFT NOK  
